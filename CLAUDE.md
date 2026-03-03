# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Before starting any non-trivial work, read [`VISION.md`](./VISION.md)** — it is the authoritative source for product direction, engineering values, roadmap milestones, and development workflow.

## Documentation Layout

| Location | What goes there |
|---|---|
| Root | `README.md`, `CHANGELOG.md`, `CLAUDE.md`, `VISION.md` — files tools or conventions expect at the top level |
| `docs/` | Everything else: research notes, architecture decisions, debugging guides, milestone plans |

Current docs: `docs/element-identity.md`, `docs/devcontainer-debugging.md`, `docs/plan-milestone-1.md`, `docs/plan-element-identity.md`

## What This Extension Does

A VS Code extension that renders HTML elements via Playwright (headless Chromium) and displays a screenshot in the hover tooltip when hovering over an HTML element in a `.html` file.

## Commands

```bash
pnpm run compile        # type-check + lint + bundle (use before testing)
pnpm run watch          # parallel watch: esbuild + tsc (for active development)
pnpm run check-types    # TypeScript type-check only
pnpm run lint           # ESLint only
pnpm run package        # production build (minified, no sourcemaps)
pnpm run test           # run extension tests via vscode-test
```

Press **F5** in VS Code to launch an Extension Development Host for manual testing.

## Architecture

| File | Role |
|---|---|
| `src/extension.ts` | Entry point: creates storage dirs, registers `HtmlHoverProvider` and `attachImage` command, wires cleanup |
| `src/hoverProvider.ts` | `vscode.HoverProvider` — checks `ImageStore` first, then a 50-entry/5-min TTL render cache, keyed on `uri\|elementId` |
| `src/htmlAnnotator.ts` | Parses HTML with `node-html-parser`, finds deepest element at cursor, computes stable `elementId`, injects `data-hover-id` UUID |
| `src/renderer.ts` | Playwright singleton browser — lazy-init, adaptive JPEG quality (85→70→55→40) to stay under VS Code's ~90k base64 char limit |
| `src/imageStore.ts` | Persists manually attached images in `globalStorageUri/image-store.json`; maps `cacheKey → imagePath` |
| `src/imageServer.ts` | HTTP server on port 0 — not used in the hover path (CSP blocks it); kept for future webview panel use |

**Auto-render data flow:** hover → `annotateHtml` (parse + stable `elementId`) → check `ImageStore` → check render cache → `renderElement` → base64 JPEG → `MarkdownString` with `<img>` + `📷 Attach image` command link.

**Manual attach flow:** user clicks `📷 Attach image` link → `showOpenDialog` → image copied to `globalStorageUri/attached/` → path saved in `image-store.json` → next hover reads store and shows the attached image directly.

**Element identity:** cache key is `uri\x00elementId`. `elementId` priority: `id` attr → `data-testid` → `data-component` → CSS structural path (e.g. `html > body > main > h1:nth-of-type(2)`). Stable across keystrokes; only changes when document structure changes.

> **Why base64?** VS Code's hover tooltip CSP blocks all `http://` requests including `http://127.0.0.1` even with `isTrusted = true`. Base64 data URIs bypass this entirely.

## Build System

- **Bundler:** `esbuild.js` bundles `src/extension.ts` → `dist/extension.js` (CJS, Node platform)
- **Externals:** `vscode` (VS Code runtime) and `playwright` (has native binaries, cannot be bundled) are both external
- **`node-html-parser`** is pure JS and is bundled
- TypeScript `strict` mode is enabled

## Key Constraints

- `playwright` must stay in `external` in `esbuild.js` — its native Chromium binaries cannot be bundled
- After installing playwright, run `npx playwright install chromium` to download the browser
- `pnpm` may block playwright's postinstall scripts; run `pnpm approve-builds` before `pnpm install` if needed
- `node-html-parser`'s root node from `parse()` has `tagName = null` — guard against it in `htmlAnnotator.ts`
- Each hover uses a unique UUID as the JPEG filename to avoid collisions from concurrent hovers
- `globalStorageUri/previews/` is ephemeral (wiped on deactivate); `globalStorageUri/attached/` is permanent user data — never delete it
