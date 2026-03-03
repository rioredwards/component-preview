import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { annotateHtml } from './htmlAnnotator';
import { inlineStyles } from './cssInliner';
import { renderElement } from './renderer';
import { ImageStore } from './imageStore';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 50;

interface CacheEntry {
  hover: vscode.Hover;
  timestamp: number;
}

export class HtmlHoverProvider implements vscode.HoverProvider {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private readonly previewDir: string,
    private readonly imageStore: ImageStore,
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const offset = document.offsetAt(position);

    // Parse first — elementId is only available after this
    const annotated = annotateHtml(document.getText(), offset);
    if (!annotated) {
      return null;
    }

    // Stable key: uri + structural identity. \x00 cannot appear in HTML attribute values.
    const cacheKey = `${document.uri}\x00${annotated.elementId}`;

    // Manually attached image takes priority over everything
    const attachedPath = this.imageStore.get(cacheKey);
    if (attachedPath) {
      return this.buildHover(attachedPath, annotated.elementId, document.uri.toString());
    }

    // Check render cache before firing up Playwright
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
      await renderElement({
        html: resolvedHtml,
        hoverId: annotated.hoverId,
        outputPath,
      });
    } catch (err) {
      console.error('[component-preview] render failed:', err);
      return null;
    }

    if (token.isCancellationRequested) {
      return null;
    }

    const hover = this.buildHover(outputPath, annotated.elementId, document.uri.toString());
    this.evictIfNeeded();
    this.cache.set(cacheKey, { hover, timestamp: Date.now() });
    return hover;
  }

  private buildHover(imagePath: string, elementId: string, documentUri: string): vscode.Hover {
    const ext = path.extname(imagePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const base64 = fs.readFileSync(imagePath).toString('base64');

    const args = encodeURIComponent(JSON.stringify([elementId, documentUri]));
    const attachLink = `[📷 Attach image](command:component-preview.attachImage?${args})`;

    const md = new vscode.MarkdownString(`<img src="data:${mime};base64,${base64}">\n\n${attachLink}`);
    md.supportHtml = true;
    md.isTrusted = true;
    return new vscode.Hover(md);
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
