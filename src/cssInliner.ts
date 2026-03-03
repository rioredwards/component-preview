import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Replaces all local <link rel="stylesheet"> tags with inlined <style> blocks.
 * Resolves one level of @import within each stylesheet.
 * External URLs (http://, https://, //) are left untouched.
 */
export async function inlineStyles(html: string, docDir: string): Promise<string> {
  const linkTagRegex = /<link\b([^>]*)>/gi;
  const replacements: Array<{ original: string; replacement: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = linkTagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const attrs = match[1];

    if (!/rel=["']stylesheet["']/i.test(attrs)) { continue; }

    const hrefMatch = /href=["']([^"']+)["']/i.exec(attrs);
    if (!hrefMatch) { continue; }

    const href = hrefMatch[1];
    if (/^https?:\/\/|^\/\//.test(href)) { continue; }

    const absPath = path.resolve(docDir, href);
    try {
      let css = await fs.readFile(absPath, 'utf8');
      css = await resolveImports(css, path.dirname(absPath));
      replacements.push({ original: fullTag, replacement: `<style>\n${css}\n</style>` });
    } catch (err) {
      console.warn(`[component-preview] Could not inline stylesheet ${absPath}:`, err);
    }
  }

  let result = html;
  for (const { original, replacement } of replacements) {
    result = result.replace(original, replacement);
  }
  return result;
}

/**
 * Replaces @import rules in a CSS string with the contents of the imported file.
 * One level deep only — does not recurse into nested imports.
 */
async function resolveImports(css: string, cssDir: string): Promise<string> {
  const importRegex = /@import\s+(?:url\()?["']([^"')]+)["']\)?[^;]*;/g;
  const replacements: Array<{ original: string; replacement: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(css)) !== null) {
    const fullImport = match[0];
    const importPath = match[1];

    if (/^https?:\/\/|^\/\//.test(importPath)) { continue; }

    const absPath = path.resolve(cssDir, importPath);
    try {
      const importedCss = await fs.readFile(absPath, 'utf8');
      replacements.push({ original: fullImport, replacement: importedCss });
    } catch (err) {
      console.warn(`[component-preview] Could not resolve @import ${absPath}:`, err);
    }
  }

  let result = css;
  for (const { original, replacement } of replacements) {
    result = result.replace(original, replacement);
  }
  return result;
}
