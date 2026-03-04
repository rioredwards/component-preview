# Framework Support Strategy

## Current State

The extension has two rendering paths:

1. **HTML** — Parse the file, inline CSS, render in Playwright. Self-contained, no framework
   dependencies, no dev server required. Works for any `.html` file. Not affected by anything
   discussed below.

2. **React (zero-config)** — Walk the React fiber tree on the user's running dev server.
   Intercept Vite's pre-bundled `react_jsx-dev-runtime.js` to inject `data-src-line` attributes
   via a patched `jsxDEV`. Fall back to `_debugSource` (React 18) or `_debugStack` (React 19).
   Match fibers to source lines using proximity scoring.

The React path works well for single-page Vite + React apps. It requires zero user setup.

## Known Limitations of the Zero-Config React Path

- **Vite-only.** The `require_jsx_dev_runtime` interception depends on esbuild's CommonJS
  wrapper naming convention. Webpack, Turbopack, and other bundlers use different formats.
- **Basename collisions.** Two files with the same name in different directories
  (e.g. `src/Button.tsx` and `src/admin/Button.tsx`) produce ambiguous matches.
- **Root element assumption.** Looks for `#root`, falls back to `document.body`. Apps
  mounting to `#app`, `#__next`, or custom elements may not find `__reactContainer`.
- **Single route.** Only navigates to the dev server root. Components on nested routes
  won't appear in the fiber tree.
- **Host elements only.** The `jsxDEV` patch only injects `data-src-line` on elements with
  `typeof type === "string"`. Composite components are matched indirectly through their
  nearest host descendant.
- **Fragile internals.** Fiber properties (`stateNode`, `memoizedProps`, `_debugSource`) are
  not public API. React could restructure them in any major release.
- **Unbounded recursion.** The fiber `collect()` walk has no depth limit. Deeply nested
  trees (large tables, virtualized lists) could blow the call stack inside `page.evaluate`.

## Next Phase: Vite Plugin

### Why

A Vite plugin that injects `data-cp-file` and `data-cp-line` attributes at compile time
replaces all the fragile parts of the React path:

- No fiber walking
- No runtime monkey-patching of `jsxDEV`
- No Playwright route interception
- No framework-specific introspection
- Full file paths instead of basename-only matching
- Works for React, Vue, and Svelte — any framework with a Vite transform step

Element lookup becomes a single DOM query:
```
[data-cp-file$="Button.tsx"][data-cp-line="42"]
```

### Tradeoff

Requires the user to install `vite-plugin-component-preview` and add one line to their
`vite.config.ts`. Not zero-config, but close.

### Coexistence with Zero-Config React

Keep both paths. The extension detects which strategy to use:

1. If `data-cp-file` attributes exist on the page → use the Vite plugin selector path.
2. Otherwise, fall back to fiber walking (React only, current behavior).

This gives zero-config React users the same experience they have now, while users who install
the plugin get multi-framework support and more reliable matching.

### Onboarding UX

When the extension detects a Vite project without the plugin installed:
- Show a one-time notification with a setup link.
- In the hover panel, where a preview would normally appear, show a message with a command
  link to the setup guide.

Don't auto-edit the user's `vite.config.ts` — config files vary too much in structure to
modify reliably.

## Framework Landscape

### Easy (via Vite plugin)

**Vue** — Vite-native. `__vue_app__` on root element. Component definitions carry `__file`
in dev mode. SFC templates compile to render functions through Vite's transform pipeline,
so a Vite plugin can inject source attributes during compilation. Closest to React in terms
of effort.

**Svelte** — Compiles away the framework (no virtual DOM, no component tree at runtime).
A fiber-walking approach is impossible, which makes the Vite plugin approach not just
convenient but *necessary*. The Svelte compiler runs through Vite's transform step, so
the plugin can inject attributes during compilation.

### Harder (not Vite-based)

**Next.js** — Uses Webpack or Turbopack, not Vite. SWC injects `_debugSource` in dev mode,
so the fiber-walking fallback partially works for Client Components. Server Components have
no client-side fiber tree and are not previewable with this approach. Root element is
`#__next`. Route-based rendering means components only exist on specific pages.

**Nuxt** — Vue's equivalent of Next.js. Same SSR/routing challenges. Could work if the user
runs `nuxt dev` (which uses Vite internally), but server components and route isolation
apply.

**Angular** — Own ecosystem entirely. Uses `ng.getComponent()` in dev mode. Would need a
separate adapter. Webpack or esbuild-based CLI, no Vite overlap.

### Shared vs. Framework-Specific Code

~60-70% of the codebase is framework-agnostic and fully reusable:
- Dev server detection
- Playwright browser management
- Screenshot pipeline (adaptive JPEG, overlay hiding, settle logic)
- VS Code hover provider, caching, image store
- The "attach image" feature

The framework-specific part is concentrated in one function: "given `(file, line)`, find the
DOM element." The Vite plugin makes this function a single CSS selector query for all
Vite-based frameworks.

## Architecture: Adapter Pattern

To keep framework strategies cleanly separated, use an adapter interface:

```ts
interface FrameworkAdapter {
  detect(page: Page): Promise<boolean>;
  findElement(page: Page, file: string, line: number): Promise<ElementHandle | null>;
}
```

Planned adapters:
- `VitePluginAdapter` — selector-based, works for any framework with the plugin installed
- `ReactFiberAdapter` — current fiber-walking approach, zero-config fallback for React

The dev server renderer tries each adapter in order until one succeeds.

## Prior Art

- **click-to-component** (ericclemmons) — Solves the reverse problem (DOM → source file).
  Uses `_debugSource` from fibers. Works with Next.js, CRA, Vite.
- **vite-plugin-react-click-to-component** (ArnaudBarre) — Vite-specific version. Patches
  the JSX dev runtime to reinject source info — the same strategy as our `jsxDevPatch.ts`.
- **vite-plugin-vue-inspector** — Vue equivalent. Confirms each framework needs its own
  source-location mapping.

These tools validate the overall approach. The Vite plugin strategy aligns with how the
ecosystem is already solving this class of problem.
