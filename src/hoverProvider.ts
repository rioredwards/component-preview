import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { inlineStyles } from "./cssInliner";
import { detectDevServer } from "./devServerDetector";
import {
  DevServerMatchMetadata,
  ERROR_MISSING_VITE_PLUGIN,
  MissingVitePluginError,
  renderFromDevServer,
} from "./devServerRenderer";
import { annotateHtml } from "./htmlAnnotator";
import { ImageStore } from "./imageStore";
import { info, error as logError } from "./logger";
import { isPluginOnlyFrameworkFile, shouldPersistPluginPromptDismissal } from "./pluginOnboarding";
import { renderElement } from "./renderer";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 50;
const PLUGIN_SETUP_STATE_KEY = "component-preview.plugin-setup-dismissed";
const NOTICE_TTL_MS = 60_000;

export const PLUGIN_SETUP_COMMAND = "component-preview.openPluginSetup";

interface CacheEntry {
  hover: vscode.Hover;
  timestamp: number;
}

export class HtmlHoverProvider implements vscode.HoverProvider {
  private cache = new Map<string, CacheEntry>();
  private pluginSetupPromptInFlight = false;
  private noServerNoticeAtByWorkspace = new Map<string, number>();
  private mismatchNoticeAtByWorkspace = new Map<string, number>();
  private iconDataUri: string | null = null;

  constructor(
    private readonly previewDir: string,
    private readonly imageStore: ImageStore,
    private readonly globalState: vscode.Memento,
    private readonly iconPath: string,
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
      return await this.buildHover(attachedPath);
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
      void this.maybeShowNoServerNotification(workspaceRoot);
      return await this.buildNoServerHover();
    }

    let outputPath = path.join(this.previewDir, `${randomUUID()}.jpeg`);
    let matchMetadata: DevServerMatchMetadata | null = null;
    try {
      matchMetadata = await renderFromDevServer({
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
        return await this.buildPluginSetupHover();
      }
      const errorMessage = this.getErrorMessage(err);
      logError("dev server render failed:", errorMessage ?? err);
      void this.maybeShowServerMismatchNotification(workspaceRoot, devServerUrl, errorMessage);
      return await this.buildDevServerMismatchHover(devServerUrl, errorMessage);
    }

    if (
      matchMetadata &&
      this.isComponentInvocationHover(document, position) &&
      !this.isExactSourceMatch(matchMetadata, document.uri.fsPath, line, column)
    ) {
      const definitionTarget = await this.resolveDefinitionRenderTarget(
        document,
        position,
        workspaceRoot,
      );
      if (definitionTarget) {
        const definitionOutputPath = path.join(this.previewDir, `${randomUUID()}.jpeg`);
        try {
          const definitionMatch = await renderFromDevServer({
            devServerUrl,
            workspaceRoot,
            filePath: definitionTarget.filePath,
            line: definitionTarget.line,
            column: definitionTarget.column,
            outputPath: definitionOutputPath,
          });
          await fs.unlink(outputPath).catch(() => undefined);
          outputPath = definitionOutputPath;
          matchMetadata = definitionMatch;
        } catch (err) {
          const errorMessage = this.getErrorMessage(err);
          info("Definition fallback render failed.", errorMessage ?? "unknown error");
          await fs.unlink(definitionOutputPath).catch(() => undefined);
        }
      }
    }

    if (token.isCancellationRequested) {
      return null;
    }

    const hover = await this.buildHover(outputPath);
    this.evictIfNeeded();
    this.cache.set(cacheKey, { hover, timestamp: Date.now() });
    return hover;
  }

  private isComponentInvocationHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): boolean {
    const range = document.getWordRangeAtPosition(position, /[A-Za-z_$][\w$]*/);
    if (!range) {
      return false;
    }
    const symbol = document.getText(range);
    if (!/^[A-Z]/.test(symbol)) {
      return false;
    }
    const lineText = document.lineAt(position.line).text;
    return new RegExp(`<\\s*${symbol}\\b`).test(lineText);
  }

  private isExactSourceMatch(
    metadata: DevServerMatchMetadata,
    requestFilePath: string,
    requestLine: number,
    requestColumn: number,
  ): boolean {
    if (metadata.source.line !== requestLine || metadata.source.column !== requestColumn) {
      return false;
    }

    const sourceFile = metadata.source.file.replace(/\\/g, "/").toLowerCase();
    const requestFile = requestFilePath.replace(/\\/g, "/").toLowerCase();
    return requestFile === sourceFile || requestFile.endsWith(`/${sourceFile}`);
  }

  private async resolveDefinitionRenderTarget(
    document: vscode.TextDocument,
    position: vscode.Position,
    workspaceRoot: string,
  ): Promise<{ filePath: string; line: number; column: number } | null> {
    const defs = (await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      document.uri,
      position,
    )) as Array<vscode.Location | vscode.LocationLink> | undefined;

    if (!defs || defs.length === 0) {
      return null;
    }

    for (const def of defs) {
      const uri = "targetUri" in def ? def.targetUri : def.uri;
      const start = "targetRange" in def ? def.targetRange.start : def.range.start;
      if (uri.scheme !== "file") {
        continue;
      }

      const fsPath = uri.fsPath;
      if (!/\.(tsx|jsx|vue|svelte)$/i.test(fsPath)) {
        continue;
      }
      if (!fsPath.startsWith(workspaceRoot)) {
        continue;
      }
      if (fsPath.includes("/node_modules/")) {
        continue;
      }

      return {
        filePath: fsPath,
        line: start.line + 1,
        column: start.character + 1,
      };
    }

    return null;
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
      return await this.buildHover(attachedPath);
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

    const hover = await this.buildHover(outputPath);
    this.evictIfNeeded();
    this.cache.set(cacheKey, { hover, timestamp: Date.now() });
    return hover;
  }

  private async getBrandHeader(): Promise<string> {
    if (this.iconDataUri === null) {
      try {
        const ext = path.extname(this.iconPath).toLowerCase();
        const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
        const base64 = (await fs.readFile(this.iconPath)).toString("base64");
        this.iconDataUri = `data:${mime};base64,${base64}`;
      } catch {
        this.iconDataUri = "";
      }
    }

    const extensionLink =
      "https://marketplace.visualstudio.com/items?itemName=RioEdwards.component-preview";
    const titleLink = `[**Component Preview**](${extensionLink})`;

    if (!this.iconDataUri) {
      return titleLink;
    }

    return `<img src="${this.iconDataUri}" width="48" height="48" style="vertical-align:middle;margin-right:6px;" /> ${titleLink}`;
  }

  private async buildHover(imagePath: string): Promise<vscode.Hover> {
    const ext = path.extname(imagePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    const base64 = (await fs.readFile(imagePath)).toString("base64");
    const brandHeader = await this.getBrandHeader();

    const copyPathArgs = encodeURIComponent(JSON.stringify([imagePath]));
    const copyPathLink = `[Copy preview file path](command:component-preview.copyPreviewPath?${copyPathArgs})`;

    const md = new vscode.MarkdownString(
      `${brandHeader}\n\n<img src="data:${mime};base64,${base64}">\n\n${copyPathLink}`,
    );
    md.supportHtml = true;
    md.isTrusted = true;
    return new vscode.Hover(md);
  }

  private async buildNoServerHover(): Promise<vscode.Hover> {
    const brandHeader = await this.getBrandHeader();
    const md = new vscode.MarkdownString(
      `${brandHeader}\n\n` +
        "No matching dev server was detected for this workspace.\n\n" +
        "Start the app for this repo, then hover again. " +
        "Set `component-preview.devServerUrl` to the exact server URL to override detection.",
    );
    md.supportHtml = true;
    md.isTrusted = true;
    return new vscode.Hover(md);
  }

  private async buildDevServerMismatchHover(
    devServerUrl: string,
    detail: string | null,
  ): Promise<vscode.Hover> {
    const detailLine = detail ? `\n\nLast error: \`${detail}\`` : "";
    const brandHeader = await this.getBrandHeader();
    const md = new vscode.MarkdownString(
      `${brandHeader}\n\nDetected dev server: \`${devServerUrl}\`.\n\n` +
        "The preview could not match this hover target. This often means the detected server belongs to a different app or route.\n\n" +
        "Set `component-preview.devServerUrl` to the exact app URL for this workspace, then hover again." +
        detailLine,
    );
    md.supportHtml = true;
    md.isTrusted = true;
    return new vscode.Hover(md);
  }

  private async buildPluginSetupHover(): Promise<vscode.Hover> {
    const brandHeader = await this.getBrandHeader();
    const md = new vscode.MarkdownString(
      `${brandHeader}\n\n` +
        "Vue and Svelte previews need the Vite plugin.\n\n" +
        `[Install vite-plugin-component-preview](command:${PLUGIN_SETUP_COMMAND})`,
    );
    md.supportHtml = true;
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

  private getErrorMessage(err: unknown): string | null {
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err === "string") {
      return err;
    }
    if (err && typeof err === "object") {
      const value = (err as { message?: unknown }).message;
      if (typeof value === "string") {
        return value;
      }
    }
    return null;
  }

  private shouldShowNotice(
    map: Map<string, number>,
    workspaceRoot: string,
    now: number = Date.now(),
  ): boolean {
    const prev = map.get(workspaceRoot);
    if (prev !== undefined && now - prev < NOTICE_TTL_MS) {
      return false;
    }
    map.set(workspaceRoot, now);
    return true;
  }

  private async maybeShowNoServerNotification(workspaceRoot: string): Promise<void> {
    if (!this.shouldShowNotice(this.noServerNoticeAtByWorkspace, workspaceRoot)) {
      return;
    }
    await vscode.window.showWarningMessage(
      "Component Preview: no matching dev server found for this workspace. Set component-preview.devServerUrl to override.",
    );
  }

  private async maybeShowServerMismatchNotification(
    workspaceRoot: string,
    devServerUrl: string,
    detail: string | null,
  ): Promise<void> {
    if (!this.shouldShowNotice(this.mismatchNoticeAtByWorkspace, workspaceRoot)) {
      return;
    }
    const suffix = detail ? ` (${detail})` : "";
    await vscode.window.showWarningMessage(
      `Component Preview: detected ${devServerUrl} but could not match this hover target${suffix}`,
    );
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
