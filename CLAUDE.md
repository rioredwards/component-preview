# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Before starting any non-trivial work, read [`VISION.md`](./VISION.md)** — it is the authoritative source for product direction, engineering values, roadmap milestones, and development workflow.

## Documentation Layout

| Location | What goes there |
|---|---|
| Root | `README.md`, `CHANGELOG.md`, `CLAUDE.md`, `VISION.md` — files tools or conventions expect at the top level |
| `docs/` | Everything else: research notes, architecture decisions, debugging guides, milestone plans |

Key docs: `docs/element-identity.md`, `docs/devcontainer-debugging.md`, `docs/plan-milestone-1.md`, `docs/plan-element-identity.md`, `docs/plan-milestone-2.md`, `docs/architecture-rendering-strategy.md`, `docs/react-fiber-internals.md`, `docs/smoke-test-log.md`, `docs/framework-support-strategy.md`

## What This Extension Does

A VS Code extension that renders live previews of HTML elements and React components via Playwright (headless Chromium) and displays the screenshot in the hover tooltip. Works for both plain `.html` files and `.tsx`/`.jsx` React files (when a dev server is running).

## Commands

```bash
pnpm run compile        # type-check + lint + bundle (use before testing)
pnpm run watch          # parallel watch: esbuild + tsc (for active development)
pnpm run check-types    # TypeScript type-check only
pnpm run lint           # ESLint only
pnpm run package        # production build (minified, no sourcemaps)
pnpm run test           # run extension tests via vscode-test
pnpm run test:unit      # run vitest unit tests (pure functions, no VS Code needed)
```

Press **F5** in VS Code to launch an Extension Development Host for manual testing.

## Architecture

| File | Role |
|---|---|
| `src/extension.ts` | Entry point: creates storage dirs, registers `HtmlHoverProvider` and `attachImage` command, wires cleanup |
| `src/hoverProvider.ts` | `vscode.HoverProvider` — routes `.html` to static path, `.tsx/.jsx` to React dev server path |
| `src/htmlAnnotator.ts` | Parses HTML with `node-html-parser`, finds deepest element at cursor, computes stable `elementId`, injects `data-hover-id` UUID |
| `src/renderer.ts` | Playwright singleton browser — lazy-init, delegates to `screenshotPipeline` for adaptive JPEG capture |
| `src/screenshotConstants.ts` | Shared constants: `MAX_BYTES`, `QUALITY_STEPS`, `MAX_CAPTURE_WIDTH/HEIGHT` |
| `src/screenshotPipeline.ts` | `captureAdaptiveJpeg()` — quality-stepping loop + resize fallback, used by both render paths |
| `src/devServerDetector.ts` | Scans common ports (5173, 3000, 4173, 8080, 8000) to find a running Vite/CRA dev server; 30s cache TTL with liveness check |
| `src/devServerRenderer.ts` | React path: walks fiber tree, scores candidates, screenshots DOM node |
| `src/jsxDevPatch.ts` | `JSX_DEV_RUNTIME_PATCH` — IIFE that wraps `jsxDEV` to inject `data-src-line` prop |
| `src/fiberScoring.ts` | `scoreFiber()` — canonical scoring function (browser-side keeps inline copy) |
| `src/logger.ts` | `initLogger()` creates VS Code Output channel; `debug`/`info`/`warn`/`error` levels; file + channel output |
| `src/imageStore.ts` | Persists manually attached images in `globalStorageUri/image-store.json`; maps `cacheKey → imagePath` |

**Static HTML data flow:** hover → `annotateHtml` (parse + stable `elementId`) → check `ImageStore` → check render cache → `inlineStyles` → `renderElement` → base64 JPEG → `MarkdownString`.

**React data flow:** hover → detect dev server → check `ImageStore` → check render cache → `renderFromDevServer` (fiber scan → best-match DOM node → screenshot) → base64 JPEG → `MarkdownString`.

**Manual attach flow:** user clicks `📷 Attach image` link → `showOpenDialog` → image copied to `globalStorageUri/attached/` → path saved in `image-store.json` → next hover reads store and shows the attached image directly.

**Element identity (static HTML):** cache key is `uri\x00elementId`. `elementId` priority: `id` attr → `data-testid` → `data-component` → CSS structural path (e.g. `html > body > main > h1:nth-of-type(2)`).

**Element identity (React):** cache key is `uri\x00line:col` (VS Code 0-based position converted to 1-based).

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
- React 19 dropped `_debugSource`; source lines come from our `jsxDEV` route intercept (`data-src-line` prop) — see `docs/react-fiber-internals.md`
- `__reactContainer$<key>` always holds the **stale** initial HostRoot fiber; live tree is at `stale.stateNode.current`
- Log file for React path diagnostics: `<os.tmpdir()>/component-preview-debug.log` (platform-specific)
