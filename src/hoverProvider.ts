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
import { EXTENSION_MARKETPLACE_LINK } from "./extensionConstants";
import { assembleHoverMarkdown } from "./hoverMarkdown";
import { annotateHtml } from "./htmlAnnotator";
import { ImageStore } from "./imageStore";
import { info, error as logError } from "./logger";
import { isPluginOnlyFrameworkFile, shouldPersistPluginPromptDismissal } from "./pluginOnboarding";
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
  private iconDataUri: string | null = null;
  private errorIconDataUri: string | null = null;

  constructor(
    private readonly previewDir: string,
    private readonly imageStore: ImageStore,
    private readonly globalState: vscode.Memento,
    private readonly iconPath: string,
    private readonly errorIconPath: string,
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
      return this.buildErrorHover();
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
        return this.buildErrorHover();
      }
      const errorMessage = this.getErrorMessage(err);
      logError("dev server render failed:", errorMessage ?? err);
      return this.buildErrorHover();
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

    const isInvocationHover = this.isComponentInvocationHover(document, position);
    const labelHint = this.deriveFrameworkLabelHint(
      document,
      position,
      matchMetadata,
      isInvocationHover,
    );
    const hover = await this.buildHover(outputPath, labelHint);
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

    const labelHint = this.deriveHtmlLabelHint(document, position);
    const hover = await this.buildHover(outputPath, labelHint);
    this.evictIfNeeded();
    this.cache.set(cacheKey, { hover, timestamp: Date.now() });
    return hover;
  }

  private deriveFrameworkLabelHint(
    document: vscode.TextDocument,
    position: vscode.Position,
    matchMetadata?: DevServerMatchMetadata | null,
    isInvocationHover: boolean = false,
  ): string {
    const componentOrFile = this.deriveFrameworkBaseLabel(document, position, matchMetadata);

    if (isInvocationHover) {
      return `${componentOrFile}-call-l${position.line + 1}c${position.character + 1}`;
    }

    if (matchMetadata) {
      const tag = matchMetadata.element.tag || "element";
      const line = matchMetadata.source.line;
      const column = matchMetadata.source.column;
      return `${componentOrFile}-${tag}-l${line}c${column}`;
    }

    return componentOrFile;
  }

  private deriveFrameworkBaseLabel(
    document: vscode.TextDocument,
    position: vscode.Position,
    matchMetadata?: DevServerMatchMetadata | null,
  ): string {
    const sourceFile = matchMetadata?.source.file;
    if (sourceFile) {
      const fileName = sourceFile.split(/[\\/]/).pop() ?? sourceFile;
      const stem = fileName.replace(/\.[^.]+$/, "");
      if (stem) {
        return stem;
      }
    }

    const range = document.getWordRangeAtPosition(position, /[A-Za-z_$][\w$]*/);
    const symbol = range ? document.getText(range) : "";
    if (/^[A-Z][\w$]*$/.test(symbol)) {
      return symbol;
    }

    return path.basename(document.uri.fsPath, path.extname(document.uri.fsPath));
  }

  private deriveHtmlLabelHint(document: vscode.TextDocument, position: vscode.Position): string {
    const stem = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath));
    return `${stem}-l${position.line + 1}c${position.character + 1}`;
  }

  private getTextOnlyBrandHeader(): string {
    return `[**Component Preview**](${EXTENSION_MARKETPLACE_LINK})`;
  }

  private async getBrandHeader(): Promise<string> {
    if (this.iconDataUri === null) {
      try {
        const base64 = (await fs.readFile(this.iconPath)).toString("base64");
        this.iconDataUri = `data:image/png;base64,${base64}`;
      } catch {
        this.iconDataUri = "";
      }
    }

    if (!this.iconDataUri) {
      return this.getTextOnlyBrandHeader();
    }

    return `<img src="${this.iconDataUri}" width="auto" height="16" style="vertical-align:middle;margin-right:8px;" /> ${this.getTextOnlyBrandHeader()}`;
  }

  private async getErrorHeader(): Promise<string> {
    if (this.errorIconDataUri === null) {
      try {
        const base64 = (await fs.readFile(this.errorIconPath)).toString("base64");
        this.errorIconDataUri = `data:image/png;base64,${base64}`;
      } catch {
        this.errorIconDataUri = "";
      }
    }

    if (!this.errorIconDataUri) {
      return this.getTextOnlyBrandHeader();
    }

    return `<img src="${this.errorIconDataUri}" width="auto" height="16" style="vertical-align:middle;margin-right:8px;" /> ${this.getTextOnlyBrandHeader()}`;
  }

  private async buildHover(imagePath: string, labelHint?: string): Promise<vscode.Hover> {
    const ext = path.extname(imagePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    const base64 = (await fs.readFile(imagePath)).toString("base64");
    const brandHeader = await this.getBrandHeader();
    const textOnlyBrandHeader = this.getTextOnlyBrandHeader();

    const copyPathArgs = encodeURIComponent(JSON.stringify([imagePath]));
    const copyPathLink = `[$(copy)](command:component-preview.copyPreviewPath?${copyPathArgs} "Copy Preview Image")`;
    const prArgs = encodeURIComponent(JSON.stringify([imagePath, labelHint ?? ""]));
    const prLink = `[$(git-pull-request)](command:component-preview.savePreviewForPr?${prArgs} "Save to Repo + Copy PR Markdown")`;

    const actionLinks = `${copyPathLink} ${prLink}`;
    const markdownValue = assembleHoverMarkdown(
      base64,
      mime,
      brandHeader,
      textOnlyBrandHeader,
      actionLinks,
    );

    const md = new vscode.MarkdownString(markdownValue);
    md.supportHtml = true;
    md.supportThemeIcons = true;
    md.isTrusted = true;
    return new vscode.Hover(md);
  }

  private async buildErrorHover(): Promise<vscode.Hover> {
    const brandHeader = await this.getErrorHeader();
    const helpLink = `[$(question)](${EXTENSION_MARKETPLACE_LINK} "Help")`;
    const md = new vscode.MarkdownString(`${brandHeader} | ${helpLink}`);
    md.supportHtml = true;
    md.supportThemeIcons = true;
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
