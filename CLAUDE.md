# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Before starting any non-trivial work, read [`VISION.md`](./VISION.md)** — it is the authoritative source for product direction, engineering values, roadmap milestones, and development workflow.

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

The extension has five moving pieces, each in its own module:

| File | Role |
|---|---|
| `src/extension.ts` | Entry point: creates `previewDir`, starts image server, registers `HtmlHoverProvider`, wires cleanup |
| `src/hoverProvider.ts` | `vscode.HoverProvider` — caches up to 50 results with 5-min TTL, keyed on `uri\|version\|offset` |
| `src/htmlAnnotator.ts` | Parses HTML with `node-html-parser`, finds deepest element at cursor offset, splices `data-hover-id` into the tag |
| `src/renderer.ts` | Playwright singleton browser — lazy-init, screenshots the annotated element, always closes the page in `finally` |
| `src/imageServer.ts` | `http.createServer` on port 0 (127.0.0.1), serves PNGs from `previewDir`; present but not used in the hover path (see note below) |

**Data flow:** hover event → `annotateHtml` injects UUID → `renderElement` writes PNG to `previewDir` → PNG read back as base64 → `MarkdownString` with `<img src="data:image/png;base64,...">` (requires `supportHtml = true` and `isTrusted = true`).

> **Why base64 and not the image server?** VS Code's hover tooltip webview enforces a CSP that blocks all `http://` requests — including `http://127.0.0.1` — even with `isTrusted = true`. Base64 data URIs sidestep this entirely. `imageServer.ts` is kept for potential future use (e.g. webview panels).

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
- Each hover uses a unique UUID as the PNG filename to avoid collisions from concurrent hovers
