# Vite Plugin + Adapter Pattern for Multi-Framework Support
## Problem
The current React fiber-walking approach is Vite-specific, fragile (depends on React internals and esbuild naming conventions), and only supports React. A Vite plugin that injects source-location `data-*` attributes at compile time would replace the fragile parts with a single CSS selector query, and extend support to Vue and Svelte with no additional framework-specific code in the extension.
## Current State
* `devServerRenderer.ts` contains ~100 lines of inline `page.evaluate` code that walks the React fiber tree, extracts debug metadata, scores candidates, and returns a DOM element.
* `jsxDevPatch.ts` monkey-patches the Vite-prebundled `react_jsx-dev-runtime.js` at the network layer.
* `hoverProvider.ts` dispatches to `provideHoverReact` for `.tsx`/`.jsx` files, which calls `renderFromDevServer`.
* The extension activates for `html`, `typescriptreact`, and `javascriptreact` only.
## Proposed Changes
### Part 1: Create `vite-plugin-component-preview` package
New directory: `packages/vite-plugin-component-preview/`
This is a standalone npm package the user installs in their project. It exports a single Vite plugin function.
Structure:
```warp-runnable-command
packages/vite-plugin-component-preview/
  package.json
  tsconfig.json
  src/
    index.ts          # plugin entry, exports default function
    transformJsx.ts   # JSX attribute injection
    transformVue.ts   # Vue SFC template injection
    transformSvelte.ts # Svelte markup injection
  test/
    transformJsx.test.ts
    transformVue.test.ts
    transformSvelte.test.ts
```
Dependencies: `@babel/parser` (for JSX AST parsing), `magic-string` (source-map-preserving edits). No framework-specific compiler dependencies — Vue and Svelte templates are parsed with lightweight heuristics since we only need to find opening tags.
### Part 2: Plugin implementation
#### Entry point (`index.ts`)
* Returns a Vite plugin object with `name: 'component-preview'` and `enforce: 'pre'` (runs before framework plugins so we modify raw source).
* `configResolved` hook: capture `config.root` for computing relative file paths.
* `transform(code, id)` hook: dispatch to the appropriate transform based on file extension:
    * `.jsx` / `.tsx` → `transformJsx`
    * `.vue` → `transformVue`
    * `.svelte` → `transformSvelte`
* Skip `node_modules` and non-dev builds (`config.command !== 'serve'`).
* Each transform returns `{ code, map }` where `map` comes from `magic-string`.
#### JSX transform (`transformJsx.ts`)
* Parse with `@babel/parser` (plugins: `jsx`, `typescript`).
* Traverse the AST to find `JSXOpeningElement` nodes.
* For each element: compute the 1-based line number from `node.loc.start.line`. Skip JSX fragments (`<>`).
* Use `magic-string` to insert ` data-cp-file="{relativePath}" data-cp-line="{line}"` just before the `>` of each opening tag, using the node's positional info.
* Return `{ code: s.toString(), map: s.generateMap() }`.
#### Vue transform (`transformVue.ts`)
* Find the `<template>` block boundaries with a simple regex (`<template[^>]*>` and `</template>`).
* Within the template region, find opening HTML tags with a regex that matches `<tag-name` (excluding `<template>`, `<script>`, `<style>`, and Vue control-flow like `<slot>`).
* For each match: compute the line number, use `magic-string` to insert the `data-cp-*` attributes before the closing `>`.
* Handle self-closing tags (`/>`) the same way.
#### Svelte transform (`transformSvelte.ts`)
* Identify markup regions: everything outside `<script>...</script>` and `<style>...</style>` blocks.
* Within markup regions, find opening HTML tags with the same regex approach as Vue (excluding `<script>`, `<style>`, Svelte special elements like `<svelte:head>`, and block syntax `{#if}`, `{#each}`).
* Inject `data-cp-*` attributes the same way.
#### Attribute format
* `data-cp-file`: path relative to Vite's `config.root`, e.g. `src/components/Button.tsx`.
* `data-cp-line`: 1-based line number of the opening tag.
* Dev-only: the plugin is a no-op when `config.command === 'build'`.
### Part 3: Adapter pattern in the extension
Refactor `devServerRenderer.ts` to use pluggable adapters.
#### New file: `src/frameworkAdapter.ts`
Define the interface:
```ts
export interface FrameworkAdapter {
  name: string;
  detect(page: Page): Promise<boolean>;
  findElement(page: Page, file: string, line: number): Promise<ElementHandle | null>;
}
```
#### New file: `src/vitePluginAdapter.ts`
* `detect`: run `page.evaluate(() => !!document.querySelector('[data-cp-file]'))`. If any element has the attribute, the plugin is active.
* `findElement`: compute the relative file path (strip workspace root prefix). Query `page.$(`[data-cp-file="${relPath}"][data-cp-line="${line}"]`)`. If multiple matches, return the first visible one (bounding box > 2×2, same logic as current).
* Fallback: if exact line match fails, use the same proximity scoring as current — query all `[data-cp-file="${relPath}"]` elements, read their `data-cp-line`, score, and return the best match.
#### New file: `src/reactFiberAdapter.ts`
Extract the existing fiber-walking `page.evaluate` block and the `jsxDevPatch` route interception from `devServerRenderer.ts` into this adapter. Same logic, just behind the adapter interface.
#### Refactored `devServerRenderer.ts`
* `getDevPage`: remove the `page.route` interception for `react_jsx-dev-runtime.js` (moved to `reactFiberAdapter`).
* `renderFromDevServer`: accept an ordered list of adapters. Try `vitePluginAdapter.detect()` first, then `reactFiberAdapter.detect()`. Use whichever succeeds to call `findElement()`.
* The `ReactFiberAdapter` registers its route interception in its own `detect()` or a separate `initialize(page)` method, called only when that adapter is selected.
### Part 4: Extend language support
* `extension.ts`: add `{ language: "vue", scheme: "file" }` and `{ language: "svelte", scheme: "file" }` to the hover provider registration.
* `package.json`: add `onLanguage:vue` and `onLanguage:svelte` to `activationEvents`.
* `hoverProvider.ts`: update `provideHover` to route `.vue` and `.svelte` files to the dev-server path (same as React). The file-type check becomes: `isFrameworkFile = /\.(tsx|jsx|vue|svelte)$/.test(filePath)`.
### Part 5: Onboarding UX
When the Vite plugin adapter's `detect()` returns false for a `.vue` or `.svelte` file:
* Show a one-time VS Code notification: "Install vite-plugin-component-preview for live hover previews" with a "Learn more" button linking to the plugin README.
* Use `context.globalState` to track whether the notification has been dismissed, so it only shows once.
* For `.tsx`/`.jsx` files, the fiber-walking fallback means no notification is needed — previews work without the plugin.
### Part 6: Testing
#### Vite plugin unit tests (vitest, in the plugin package)
* **JSX**: verify that `transformJsx` injects `data-cp-file` and `data-cp-line` on `<div>`, `<Component>`, self-closing tags. Verify it skips fragments (`<>`), string literals containing `<`, and template literals.
* **Vue**: verify injection inside `<template>` only, skips `<script>` and `<style>` content, handles self-closing components.
* **Svelte**: verify injection in markup, skips `<script>` and `<style>` blocks, skips `{#if}`/`{#each}` block syntax.
* **Source maps**: verify `magic-string` generates valid maps (line numbers still resolve correctly).
#### Extension adapter tests
* Unit test for `VitePluginAdapter.findElement` logic (proximity scoring fallback).
* Integration test using the existing `inspect-fibers` script pattern: run a small Vite+React fixture app with the plugin installed, verify `data-cp-*` attributes appear in the DOM, verify the adapter finds the correct element for a given file+line.
## Sequencing
1. Create plugin package scaffolding and JSX transform (gets React working via plugin).
2. Add the adapter pattern to the extension + `VitePluginAdapter`.
3. Extract fiber walking into `ReactFiberAdapter` (keeps zero-config React working).
4. Wire up adapter selection in `devServerRenderer.ts`.
5. Add Vue and Svelte transforms to the plugin.
6. Extend extension language support for `.vue` / `.svelte`.
7. Add onboarding notification for non-React frameworks.
8. Tests throughout.
