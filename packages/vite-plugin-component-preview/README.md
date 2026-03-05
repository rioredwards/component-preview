# vite-plugin-component-preview

Vite plugin that injects source metadata attributes used by the `component-preview` VS Code extension.

Injected dev-only attributes:

- `data-cp-file`
- `data-cp-line`
- `data-cp-col`
- `data-cp-loc`

The plugin also sets:

- `window.__COMPONENT_PREVIEW_PLUGIN__ = { version: string }`

## Install

```sh
npm install -D vite-plugin-component-preview
```

## Usage

```ts
import { defineConfig } from "vite";
import componentPreview from "vite-plugin-component-preview";

export default defineConfig({
  plugins: [componentPreview()],
});
```

## Options

```ts
componentPreview({
  include: [/src\/.*/],
  exclude: [/node_modules/],
  markerGlobal: "__COMPONENT_PREVIEW_PLUGIN__",
});
```

## Notes

- The transform runs in `vite serve` mode only.
- It supports JSX/TSX, Vue SFC templates, and Svelte markup.
