import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { inlineStyles } from "./cssInliner";
import { detectDevServer } from "./devServerDetector";
import {
  ERROR_MISSING_VITE_PLUGIN,
  MissingVitePluginError,
  renderFromDevServer,
} from "./devServerRenderer";
import { annotateHtml } from "./htmlAnnotator";
import { ImageStore } from "./imageStore";
import { error as logError, info } from "./logger";
import {
  isPluginOnlyFrameworkFile,
  shouldPersistPluginPromptDismissal,
} from "./pluginOnboarding";
import { renderElement } from "./renderer";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 50;
const PLUGIN_SETUP_STATE_KEY = "component-preview.plugin-setup-dismissed";

export const PLUGIN_SETUP_COMMAND = "component-preview.openPluginSetup";

interface CacheEntry {
  hover: vscode.Hover;
  timestamp: number;
}

export class HtmlHoverProvider implements vscode.HoverProvider {
  private cache = new Map<string, CacheEntry>();
  private pluginSetupPromptInFlight = false;

  constructor(
    private readonly previewDir: string,
    private readonly imageStore: ImageStore,
    private readonly globalState: vscode.Memento,
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | null> {
    const filePath = document.uri.fsPath;
    const isFrameworkFile = /\.(tsx|jsx|vue|svelte)$/i.test(filePath);

    return isFrameworkFile
      ? this.provideHoverFramework(document, position, token)
      : this.provideHoverHtml(document, position, token);
  }

  private async provideHoverFramework(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | null> {
    const line = position.line + 1;
    const column = position.character + 1;
    const elementId = `${line}:${column}`;
    const cacheKey = `${document.uri}\x00${elementId}`;

    const attachedPath = this.imageStore.get(cacheKey);
    if (attachedPath) {
      return await this.buildHover(attachedPath, elementId, document.uri.toString());
    }

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.hover;
    }

    if (token.isCancellationRequested) {
      return null;
    }

    const workspaceRoot =
      vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath ??
      path.dirname(document.uri.fsPath);

    const configuredUrl =
      vscode.workspace
        .getConfiguration("component-preview", document.uri)
        .get<string>("devServerUrl") ?? null;

    const devServerUrl = await detectDevServer({
      preferredUrl: configuredUrl,
      workspaceRoot,
    });

    if (!devServerUrl) {
      info("No dev server detected.");
      return this.buildNoServerHover();
    }

    const outputPath = path.join(this.previewDir, `${randomUUID()}.jpeg`);
    try {
      await renderFromDevServer({
        devServerUrl,
        workspaceRoot,
        filePath: document.uri.fsPath,
        line,
        column,
        outputPath,
      });
    } catch (err) {
      if (this.isMissingPluginError(err, document.uri.fsPath)) {
        await this.maybeShowPluginSetupNotification();
        return this.buildPluginSetupHover();
      }
      logError("dev server render failed:", err);
      return null;
    }

    if (token.isCancellationRequested) {
      return null;
    }

    const hover = await this.buildHover(outputPath, elementId, document.uri.toString());
    this.evictIfNeeded();
    this.cache.set(cacheKey, { hover, timestamp: Date.now() });
    return hover;
  }

  private async provideHoverHtml(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | null> {
    const offset = document.offsetAt(position);

    const annotated = annotateHtml(document.getText(), offset);
    if (!annotated) {
      return null;
    }

    const cacheKey = `${document.uri}\x00${annotated.elementId}`;

    const attachedPath = this.imageStore.get(cacheKey);
    if (attachedPath) {
      return await this.buildHover(attachedPath, annotated.elementId, document.uri.toString());
    }

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.hover;
    }

    if (token.isCancellationRequested) {
      return null;
    }

    const docDir = path.dirname(document.uri.fsPath);
    const resolvedHtml = await inlineStyles(annotated.html, docDir);

    const outputPath = path.join(this.previewDir, `${annotated.hoverId}.jpeg`);
    try {
      await renderElement({ html: resolvedHtml, hoverId: annotated.hoverId, outputPath });
    } catch (err) {
      logError("render failed:", err);
      return null;
    }

    if (token.isCancellationRequested) {
      return null;
    }

    const hover = await this.buildHover(outputPath, annotated.elementId, document.uri.toString());
    this.evictIfNeeded();
    this.cache.set(cacheKey, { hover, timestamp: Date.now() });
    return hover;
  }

  private async buildHover(imagePath: string, elementId: string, documentUri: string): Promise<vscode.Hover> {
    const ext = path.extname(imagePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    const base64 = (await fs.readFile(imagePath)).toString("base64");

    const args = encodeURIComponent(JSON.stringify([elementId, documentUri]));
    const attachLink = `[📷 Attach image](command:component-preview.attachImage?${args})`;

    const md = new vscode.MarkdownString(
      `<img src="data:${mime};base64,${base64}">\n\n${attachLink}`,
    );
    md.supportHtml = true;
    md.isTrusted = true;
    return new vscode.Hover(md);
  }

  private buildNoServerHover(): vscode.Hover {
    const md = new vscode.MarkdownString(
      "Start your frontend dev server, then hover again.\n\n" +
        "Set `component-preview.devServerUrl` if your server runs on a custom URL.",
    );
    return new vscode.Hover(md);
  }

  private buildPluginSetupHover(): vscode.Hover {
    const md = new vscode.MarkdownString(
      "Vue and Svelte previews need the Vite plugin.\n\n" +
        `[Install vite-plugin-component-preview](command:${PLUGIN_SETUP_COMMAND})`,
    );
    md.isTrusted = true;
    return new vscode.Hover(md);
  }

  private async maybeShowPluginSetupNotification(): Promise<void> {
    if (this.pluginSetupPromptInFlight) {
      return;
    }
    const dismissed = this.globalState.get<boolean>(PLUGIN_SETUP_STATE_KEY, false);
    if (dismissed) {
      return;
    }

    this.pluginSetupPromptInFlight = true;
    try {
      const learnMore = "Learn more";
      const dismiss = "Dismiss";
      const choice = await vscode.window.showInformationMessage(
        "Install vite-plugin-component-preview for Vue/Svelte live hover previews.",
        learnMore,
        dismiss,
      );

      if (choice === learnMore) {
        await vscode.commands.executeCommand(PLUGIN_SETUP_COMMAND);
      }

      if (shouldPersistPluginPromptDismissal(choice)) {
        await this.globalState.update(PLUGIN_SETUP_STATE_KEY, true);
      }
    } finally {
      this.pluginSetupPromptInFlight = false;
    }
  }

  private isMissingPluginError(err: unknown, filePath: string): boolean {
    if (!isPluginOnlyFrameworkFile(filePath)) {
      return false;
    }

    const code =
      err instanceof MissingVitePluginError
        ? ERROR_MISSING_VITE_PLUGIN
        : err && typeof err === "object"
            ? (err as { code?: string }).code
            : undefined;

    return code === ERROR_MISSING_VITE_PLUGIN;
  }

  private evictIfNeeded(): void {
    if (this.cache.size < CACHE_MAX) {
      return;
    }
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
    }
  }
}
