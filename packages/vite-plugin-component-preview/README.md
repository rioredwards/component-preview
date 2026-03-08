# vite-plugin-component-preview

This plugin enables the **Component Preview** VS Code extension to work with Vue and Svelte.

## Supported frameworks

- React (`.jsx`, `.tsx`)
- Vue (`.vue`)
- Svelte (`.svelte`)

## Setup

### 1) Install the package

```sh
npm install -D vite-plugin-component-preview
```

### 2) Update your Vite config

In `vite.config.ts` or `vite.config.js`:

Add this import near your other imports:

```ts
import componentPreview from "vite-plugin-component-preview";
```

Then add this inside your existing plugins array:

```ts
componentPreview(),
```

Example:

```ts
// 🚨 DON'T blindly copy/paste — your config may differ!
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import componentPreview from "vite-plugin-component-preview"; // 👈 add this

export default defineConfig({
  plugins: [
    react(),
    componentPreview(), // 👈 add this
  ],
});
```

### 3) Save and restart dev server

Stop your running Vite dev server, then start it again:

```sh
npm run dev
```

### 4) Verify in editor

- Open a framework file (`.tsx`, `.jsx`, `.vue`, or `.svelte`)
- Hover a UI element/component in code
- You should see a rendered preview

## Troubleshooting

- If preview does not appear, confirm your dev server is running.
- If your app runs on a non-default URL/port, set `component-preview.devServerUrl` in VS Code settings.
- After any Vite config change, restart `npm run dev`.

## Notes

- Runs in `vite serve` only.
- Intended for local development workflows.

## Related

- Extension: `component-preview`
