# component-preview

Show rendered UI previews on hover inside VS Code.

The extension uses two rendering paths:

1. Static HTML path for `.html` files.
2. Dev server path for framework files (`.tsx`, `.jsx`, `.vue`, `.svelte`).

## Support Matrix

| File type | Works without plugin | Works with `vite-plugin-component-preview` |
| --- | --- | --- |
| `.html` | Yes | Not needed |
| `.tsx` / `.jsx` | Yes (React fiber fallback) | Yes (preferred) |
| `.vue` | No | Yes |
| `.svelte` | No | Yes |

## Install

### Extension development

```sh
npm install
npm run compile
```

Press `F5` in VS Code to launch the Extension Development Host.

### Vite plugin for Vue, Svelte, and preferred React matching

Install in your Vite app:

```sh
npm install -D vite-plugin-component-preview
```

Then add to `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import componentPreview from "vite-plugin-component-preview";

export default defineConfig({
  plugins: [componentPreview()],
});
```

## Settings

`component-preview.devServerUrl`
- Optional URL override when auto detection does not find your dev server.
- Example: `http://localhost:5173`

## How detection works

For framework files, the extension checks in this order:

1. `component-preview.devServerUrl` setting.
2. `.env` / `.env.local` (`VITE_PORT` or `PORT`).
3. `vite.config.*` `server.port`.
4. Common ports (`3000`, `5173`, `4173`, `8080`, `8000`).

## Troubleshooting

### No preview appears on `.tsx` / `.jsx`

- Confirm the app dev server is running.
- Hover again after the page finishes loading.
- Set `component-preview.devServerUrl` if your server is on a non-standard URL.

### No preview appears on `.vue` / `.svelte`

- Install and enable `vite-plugin-component-preview`.
- Restart the app dev server after adding the plugin.

### Wrong element is previewed

- Save file changes and hover again.
- Confirm your app route currently renders the hovered component.
- If two files share the same name, plugin mode is recommended for exact path matching.
