# Element Identity — Research & Findings

How do we reliably know *which* element a preview belongs to, even after the user edits the file?

This is the core unsolved problem for durable image attachment (free tier) and stable caching.

---

## The Current Problem

Our cache key is `uri|version|offset`.

- `version` increments on every keystroke → cache misses constantly
- `offset` (cursor position) shifts whenever anything above it is edited
- Result: manually attached images orphan themselves the moment the user types

---

## What React DevTools / Chrome DevTools Taught Us

### 1. Use the element's address in the tree (XPath)
Instead of "cursor is at character 847", describe the element structurally:
`body > main > section:nth-child(2) > h1`

This is stable across edits that don't change document structure. Chrome DevTools uses
this internally. We can generate it ourselves by walking the `node-html-parser` tree from
root to the hovered element.

**Best for:** plain HTML, stable cache keys, free-tier image attachment.

### 2. Use React's built-in source location (`_debugSource`)
In dev mode, React attaches `_debugSource: { fileName, lineNumber, columnNumber }` to
every fiber node. React DevTools reads this to show "source: hero.tsx:81" in the panel.

This gives us `fileName:line:col` as a durable identity — the same coordinates the cursor
is already on in VS Code.

**Best for:** Milestone 5 (React/JSX). Inject a script in the Playwright page to walk the
fiber tree from the hovered DOM node up to its React component, then read `_debugSource`.

### 3. Use existing stable attributes
If the element already has `id`, `data-testid`, `data-component`, or similar, just use
that. No need to invent our own identity system — these are already unique by convention
and survive refactors.

**Best for:** quick wins in the annotator. Check for these before falling back to XPath.

---

## Recommended Identity Strategy (by milestone)

| Milestone | File type | Identity key |
|---|---|---|
| 1 (now) | Plain HTML | XPath from root (structural path) |
| 2–3 | HTML + CSS | Same XPath |
| 4 | HTML + JS | XPath, fall back to `id`/`data-testid` |
| 5 | JSX/React | `_debugSource` fileName:line:col from fiber |
| 5 | Vue/Svelte | TBD — similar compiler debug info may exist |

---

## Implementation Notes

- **XPath generation:** walk the parsed tree from root → target, tracking tag name and
  sibling index at each level. Exclude `data-hover-id` (we inject that ourselves).
- **Fiber introspection:** inject a `<script>` into the Playwright page that does
  `element.__reactFiber$xxx._debugSource` — the property name has a hash suffix, so
  find it with `Object.keys(el).find(k => k.startsWith('__reactFiber'))`.
- **Sidecar file:** once identity is stable, store manual attachments in
  `.component-previews.json` keyed on the identity string. This file can be committed
  to git so teammates see the same previews.

---

## Related Files
- `src/htmlAnnotator.ts` — where identity/annotation logic lives today
- `src/hoverProvider.ts` — where the cache key is constructed
- `VISION.md` — milestone roadmap this feeds into
