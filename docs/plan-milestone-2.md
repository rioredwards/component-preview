# Plan: M2 — External Stylesheets

## The Problem

`renderer.ts` writes annotated HTML to `/tmp/hover-<uuid>.html` then navigates Playwright to it.
Any relative `<link href="./styles/main.css">` resolves against `/tmp/` — the CSS file is never
found and the render is unstyled.

## Fix (prototype approach)

Before passing HTML to `renderElement()`, inline all local stylesheets into the document as
`<style>` blocks. Playwright then renders a self-contained file with no external dependencies.

This is the simplest thing that works. No Playwright routing, no base URL tricks, no changes to
the renderer.

---

## Files

| File | Action |
|---|---|
| `src/cssInliner.ts` | Create: `inlineStyles(html, docDir)` |
| `src/hoverProvider.ts` | Modify: call `inlineStyles()` between `annotateHtml()` and `renderElement()` |

---

## Implementation

### 1. Create `src/cssInliner.ts`

```typescript
export async function inlineStyles(html: string, docDir: string): Promise<string>
```

**Step 1 — find `<link>` tags:**
Use a regex to find all `<link rel="stylesheet" href="...">` tags. A regex is fine here — we're
not trying to handle malformed HTML edge cases in a prototype.

```
/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi
// also handle href-before-rel order:
/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["'][^>]*>/gi
```

**Step 2 — skip external URLs:**
If `href` starts with `http://`, `https://`, or `//` — leave the tag alone, don't try to fetch it.
Remote stylesheets will fail silently anyway (Playwright won't have network access to them in most
cases), but at least we don't crash.

**Step 3 — read and inline:**
```typescript
const absPath = path.resolve(docDir, href);
const css = await fs.readFile(absPath, 'utf8');
const inlined = await resolveImports(css, path.dirname(absPath));
// replace the <link> tag with <style>inlined</style>
```

**Step 4 — handle `@import` (one level deep):**
```typescript
async function resolveImports(css: string, cssDir: string): Promise<string>
```
- Match `@import` rules: `/@import\s+(?:url\()?["']([^"')]+)["']\)?[^;]*;/g`
- Skip `@import` of external URLs (same `http://` check)
- Read the imported file, return CSS with the `@import` replaced by the file content
- Don't recurse — one level is enough for a prototype

**Error handling:** wrap each file read in a try/catch — if a CSS file can't be read, log a warning
and leave the original `<link>` tag in place (render will just be unstyled, not broken).

---

### 2. Modify `src/hoverProvider.ts`

In `provideHover()`, between the `annotateHtml()` call and the `renderElement()` call, add:

```typescript
const docDir = path.dirname(document.uri.fsPath);
const resolvedHtml = await inlineStyles(annotated.html, docDir);
```

Then pass `resolvedHtml` instead of `annotated.html` to `renderElement()`.

The cache key (`cacheKey`) doesn't change — it's still keyed on `elementId`, not on CSS content.
For a prototype, this is fine. If a CSS file changes, the element structure hasn't changed so the
cache will return the old render. Acceptable for now.

---

## Key Gotchas

- **`href` attribute order** — `href` can come before or after `rel` in the tag. Handle both with
  two passes or a combined approach.
- **Self-closing vs not** — `<link>` tags may or may not have a trailing `/` before `>`. The regex
  `[^>]*>` handles both.
- **Relative `@import` paths** — must resolve relative to the CSS file's directory, not the HTML
  document's directory.
- **No recursion needed** — one level of `@import` covers 90% of real projects. Deeper chains are
  rare and can be tackled in M3 when we're already processing CSS pipelines.

---

## Verification

1. Create a test HTML file that links an external stylesheet:
   ```html
   <link rel="stylesheet" href="./test.css">
   <button class="btn">Click me</button>
   ```
   ```css
   /* test.css */
   .btn { background: coral; color: white; padding: 12px 24px; border-radius: 6px; border: none; }
   ```
2. Hover over `<button>` — tooltip should show a styled coral button, not an unstyled one.
3. Move the CSS to a subdirectory (`./styles/test.css`) and verify it still works.
4. Add an `@import` in the CSS and verify the imported styles also apply.
5. Reference a non-existent CSS file — hover should still work (unstyled render, no crash).

---

## Out of Scope for This Spike

- `<style>` blocks that contain `@import` (uncommon, tackle in M3)
- Stylesheets fetched over HTTP (no plan to support, they just stay as `<link>` tags)
- Cache invalidation when a CSS file changes (not worth solving until M2 is solid)
- Path normalization for Windows (cross-platform paths can be addressed in a cleanup pass)
