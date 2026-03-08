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

**Note:** This app is still in early beta and being actively developed, so expect some rough edges. These will be smoothed out over time. You can submit an issue or feature request here: <TODO: Add issue tracker link>

## FAQ

### Do I need to configure anything for React?

Usually no. React (`.tsx`/`.jsx`) works out of the box in most projects.

If preview is inconsistent, set `component-preview.devServerUrl` to your running app URL.

### Does this work with Vue and Svelte?

Yes, with the Vite plugin enabled.

Install:

```sh
npm install -D vite-plugin-component-preview
```

Then add it to your Vite config and restart your dev server.

### Which editor is supported?

Component Preview is built for VS Code-compatible editors.

- VS Code
- Cursor

### Is this stable for production use?

It is usable, but still in early beta. Expect occasional rough edges while coverage and reliability improve.

## Requirements

VS Code or Cursor.

## Privacy & local storage

Component Preview renders and stores preview images locally on your machine.

- Temporary preview captures are stored in the extension's local storage area and cleaned up automatically.
- If you use copy/persist features, additional preview images may be stored locally for reuse.
- These images can contain UI from your app (including internal or NDA-protected content).

If you are not comfortable with local preview-image storage, do not use this extension in sensitive projects.
For highly sensitive or NDA-protected code/UI, review your local storage policy before enabling this workflow.

## Feedback

Feel free to reach out with any questions, feedback, or suggestions.

## Authors

Made with ❤️ by [Rio Edwards](https://www.linkedin.com/in/rio-edwards/)
