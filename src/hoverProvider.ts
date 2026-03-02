import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { annotateHtml } from './htmlAnnotator';
import { renderElement } from './renderer';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 50;

interface CacheEntry {
  hover: vscode.Hover;
  timestamp: number;
}

export class HtmlHoverProvider implements vscode.HoverProvider {
  private cache = new Map<string, CacheEntry>();

  constructor(private readonly previewDir: string) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const offset = document.offsetAt(position);
    const cacheKey = `${document.uri}|${document.version}|${offset}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.hover;
    }

    const annotated = annotateHtml(document.getText(), offset);
    if (!annotated) {
      return null;
    }

    if (token.isCancellationRequested) {
      return null;
    }

    const outputPath = path.join(this.previewDir, `${annotated.hoverId}.jpeg`);
    try {
      await renderElement({
        html: annotated.html,
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

    const base64 = fs.readFileSync(outputPath).toString('base64');
    const md = new vscode.MarkdownString(`<img src="data:image/jpeg;base64,${base64}">`);

    md.supportHtml = true;
    md.isTrusted = true;

    const hover = new vscode.Hover(md);
    this.evictIfNeeded();
    this.cache.set(cacheKey, { hover, timestamp: Date.now() });
    return hover;
  }

  private evictIfNeeded(): void {
    if (this.cache.size < CACHE_MAX) {
      return;
    }
    // Remove oldest entry
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
    }
  }
}
