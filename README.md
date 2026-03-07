# Component Preview

Show rendered UI previews on hover inside VS Code.

<p align="center">
  <img src="https://assets.rioedwards.com/component-preview/ComponentPreview_Banner.jpg" alt="Component Preview banner" width="100%" />
</p>

## Overview

Component Preview lets you hover UI code and instantly see what that component looks like.

It is built for fast feedback while you code, especially when you are scanning unfamiliar files
or trying to understand a UI quickly.

## Demo

<p align="center">
  <img src="https://assets.rioedwards.com/component-preview/ComponentPreview_Demo.gif" alt="Component Preview demo" width="100%" />
</p>

## Language support

| File type       | Works out of the box | Recommended setup |
| --------------- | -------------------- | ----------------- |
| `.html`         | Yes                  | None              |
| `.tsx` / `.jsx` | Yes                  | Optional plugin   |
| `.vue`          | Needs plugin         | Vite plugin       |
| `.svelte`       | Needs plugin         | Vite plugin       |

## Setup

### 1) Install the extension

Install **Component Preview** from the VS Code Marketplace (or Open VSX).

### 2) (Vue/Svelte recommended) Install the Vite plugin

```sh
npm install -D vite-plugin-component-preview
```

Add it to your Vite config:

```ts
import { defineConfig } from "vite";
import componentPreview from "vite-plugin-component-preview";

export default defineConfig({
  plugins: [componentPreview()],
});
```

### 3) If detection misses your dev server (important)

Set `component-preview.devServerUrl` in VS Code/Cursor settings.

How to set it:

1. Open **Settings**
2. Search for **component-preview.devServerUrl**
3. Paste your dev URL (example: `http://localhost:5173`)

Or add it directly in `settings.json`:

```json
{
  "component-preview.devServerUrl": "http://localhost:5173"
}
```

## Troubleshooting

### Preview does not appear

- Make sure your app dev server is running.
- Hover again after the page loads.
- Set `component-preview.devServerUrl` if your port is custom.

### Vue or Svelte preview does not appear

- Install the Vite plugin.
- Restart your app dev server.

### Preview looks wrong

- Save and hover again.
- Confirm the component is currently rendered in your running app.

## Packaging & release

- `npm run package:vsix` — build + create VSIX package
- `npm run vscode:publish` — publish to VS Code Marketplace (requires `VSCE_PAT`)
- `npm run open-vsx:publish` — publish to Open VSX (requires `OVSX_PAT`)
- `npm run publish:all` — package + publish to both marketplaces (requires both PATs)

### Private repo-friendly image hosting

Marketplace pages need publicly reachable HTTPS image URLs.

Set these env vars before packaging/publish to rewrite README image/content links:

- `VSCE_BASE_IMAGES_URL` (or `ASSET_BASE_URL`)
- `VSCE_BASE_CONTENT_URL` (or `CONTENT_BASE_URL`)

Example:

```bash
export VSCE_BASE_IMAGES_URL="https://assets.rioedwards.com/component-preview"
export VSCE_BASE_CONTENT_URL="https://assets.rioedwards.com/component-preview"
export VSCE_PAT="..."
export OVSX_PAT="..."
npm run publish:all
```

## Requirements

VS Code or Cursor.

## Feedback

Feel free to reach out with any questions, feedback, or suggestions.

## Authors

Made with ❤️ by [Rio Edwards](https://www.linkedin.com/in/rio-edwards/)
