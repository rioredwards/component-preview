# Architecture: Rendering Strategy

## The Core Decision

The original plan (M1–M5) was to render everything locally by reimplementing relevant parts of
the user's build system — inline CSS, compile SCSS, run Tailwind JIT, bundle JSX with esbuild,
handle Vue SFCs, etc. This works for plain HTML but breaks down badly for framework apps because:

- Every framework and bundler has its own module resolution, transform pipeline, and config
- We would always be one edge case behind the real build tool
- There is no reliable way to render a React component in isolation without its providers,
  global styles, and context — the output would frequently be wrong or broken

The right call: **don't rebuild the build system. Use the one the user already has.**

---

## Two Rendering Paths

### Path 1: Static HTML (M1 + M2 + M5)

**When:** the hovered file is a plain `.html` file (no framework detected).

**Flow:**
```
hover → annotateHtml → inlineStyles → write temp file → Playwright renders it → screenshot
```

The temp file is self-contained: all `<link>` stylesheets are replaced with `<style>` blocks
before writing, so Playwright has no external dependencies to resolve.

**Appropriate for:** static sites, plain HTML demos, email templates, docs.

---

### Path 2: Framework App + Dev Server (M3+)

**When:** the hovered file is `.tsx`, `.jsx`, `.vue`, `.svelte`, or the project has a framework
detected in `package.json`.

**Assumption:** the developer is running a dev server (Vite, CRA, Next.js, Nuxt, etc.). This is
essentially always true while actively developing a frontend app.

**Flow:**
```
hover → detect dev server URL → Playwright navigates to server root →
inject fiber scan script → find element by _debugSource → screenshot DOM node
```

No temp files. No inlining. No compilation. The dev server has already done all of that.

---

## React Fiber Scan (M3 implementation detail)

React's `createRoot()` sets `__reactContainer$<key>` on the root DOM element. This property
always points to the **stale initial HostRoot fiber**; the live committed tree is reached via
`stale.stateNode.current`. We access the fiber tree directly — no DevTools bridge needed.

**Getting source line numbers (the hard part):**

The original plan assumed fibers carry `_debugSource = { fileName, lineNumber }` (React 18,
via `babel-plugin-react-jsx-source`). React 19 dropped this. It stores `_debugStack = new
Error()` instead, but that Error's `.stack` contains *compiled* line numbers from Vite's Babel
transform, not original source lines — making it useless for matching without source map
resolution.

Fix: intercept `react_jsx-dev-runtime.js` via `page.route()` before page load, and wrap
`jsxDEV` to add `data-src-line={lineNumber}` to host element props. Babel always passes the
correct source location as the 5th argument to `jsxDEV`; React 19 ignores it, but our wrapper
captures it. The attribute flows into `fiber.memoizedProps["data-src-line"]`.

See `docs/react-fiber-internals.md` for the full technical breakdown.

**Element selection:**

Rather than requiring an exact line match (which fails for attribute lines, closing tags, blank
lines), we collect all fibers referencing the file and score by proximity:
- Exact match → score 0
- Lines before cursor → small penalty (element may still be "open")
- Lines after cursor → 3× penalty (element not yet opened)

The highest-scoring candidate's DOM element is screenshotted via Playwright element handle.

### Dev Server Detection

In order of preference:
1. Read `VITE_PORT` / `PORT` from `.env` / `.env.local`
2. Check `vite.config.ts` / `vite.config.js` for `server.port`
3. Check `next.config.js` for custom port
4. Scan common ports: 3000, 5173, 4173, 8080, 8000
5. Fall back to a VS Code setting: `component-preview.devServerUrl`

---

## Chrome Companion Extension (deferred)

A companion Chrome extension communicating with the VS Code extension over a local WebSocket
was considered and rejected for now. The dev server + Playwright approach achieves the same
goal (accurate rendering using the real build output) without requiring a second installation.

The Chrome extension becomes worth revisiting for **Pro tier** features that genuinely need
access to a live browser tab: live component state, two-way navigation (click in Chrome →
jump to source), hot-reload-aware previews, visual diff between edits.

---

## Why Not esbuild-based Isolation?

An alternative considered: bundle the hovered component on-demand with esbuild and render it
in isolation (no dev server required). Rejected because:

- React components frequently depend on context providers (Redux store, theme, i18n) that
  can't be inferred automatically — isolated renders often produce broken/empty output
- SCSS, Tailwind, CSS Modules all need additional configuration to work with esbuild
- This is essentially reimplementing Storybook, which already exists and does it better

If a user wants isolated component rendering, pointing them toward Storybook integration
(render the Storybook story for the hovered component) is a better long-term answer.
