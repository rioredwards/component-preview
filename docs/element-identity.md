# Element Identity — Research & Findings

How do we reliably know *which* element a preview belongs to, even after the user edits the file?

This is the core unsolved problem for durable image attachment (free tier) and stable caching.

---

## The Current Implementation

**Static HTML:** Cache key is `uri\x00elementId`. `elementId` priority: `id` attr → `data-testid` → `data-component` → CSS structural path (e.g. `html > body > main > h1:nth-of-type(2)`). See `src/htmlAnnotator.ts`.

**React/framework:** Cache key is `uri\x00line:col` (1-based). Source lines come from `data-src-line` (injected via jsxDEV route intercept) — React 19 dropped `_debugSource`. See `docs/react-fiber-internals.md`.

---

## What React DevTools / Chrome DevTools Taught Us

### 1. Use the element's address in the tree (XPath)
Instead of "cursor is at character 847", describe the element structurally:
`body > main > section:nth-child(2) > h1`

This is stable across edits that don't change document structure. Chrome DevTools uses
this internally. We can generate it ourselves by walking the `node-html-parser` tree from
root to the hovered element.

**Best for:** plain HTML, stable cache keys, free-tier image attachment.

### 2. Use source location from Babel/jsxDEV (current approach)
React 19 dropped `_debugSource`. We recover source lines by intercepting `react_jsx-dev-runtime.js`
and wrapping `jsxDEV` to inject `data-src-line` on host elements. This gives us `fileName:line:col`
as a durable identity — the same coordinates the cursor is on in VS Code.

**Best for:** React/JSX. See `docs/react-fiber-internals.md` for implementation details.

### 3. Use existing stable attributes
If the element already has `id`, `data-testid`, `data-component`, or similar, just use
that. No need to invent our own identity system — these are already unique by convention
and survive refactors.

**Best for:** quick wins in the annotator. Check for these before falling back to XPath.

---

## Identity Strategy (current)

| File type | Identity key |
|---|---|
| Plain HTML | `elementId`: `id` → `data-testid` → `data-component` → CSS structural path |
| React/JSX | `line:col` from `data-src-line` (jsxDEV intercept) |
| Vue/Svelte | `data-cp-file` + `data-cp-line` + `data-cp-col` (vite-plugin injects) |

---

## Implementation Notes

- **Static HTML:** `src/htmlAnnotator.ts` walks the parsed tree, computes `elementId`, injects `data-hover-id`.
- **React:** `data-src-line` is read from `fiber.memoizedProps` / `fiber.pendingProps` (injected by jsxDEV patch).
- **Sidecar file:** once identity is stable, store manual attachments in
  `.component-previews.json` keyed on the identity string. This file can be committed
  to git so teammates see the same previews.

---

## Related Files
- `src/htmlAnnotator.ts` — where identity/annotation logic lives today
- `src/hoverProvider.ts` — where the cache key is constructed
- `VISION.md` — milestone roadmap this feeds into
