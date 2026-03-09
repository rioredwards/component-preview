# Changelog

All notable changes to Component Preview are documented in this file.

## [Unreleased]

- Ongoing reliability and UX improvements.

## [0.1.0] - 2026-03-09

### Features

- Hover preview for `.html` files (static rendering via Playwright).
- Hover preview for `.tsx` / `.jsx` files with live dev server rendering.
- Vue and Svelte preview support via `vite-plugin-component-preview`.
- Adaptive JPEG compression to fit VS Code's MarkdownString size limit.
- PR-ready image export: save preview to repo and copy markdown snippet.
- Custom camera icons in hover tooltip header.
- Icon-only action buttons with tooltips above the preview image.
- Configurable `component-preview.devServerUrl` for custom dev server URLs.
- Configurable `component-preview.prImageDir` for PR export save location.

### Known limitations

- Vue and Svelte require the Vite plugin and a dev server restart after config changes.
- Preview depends on the component being actively rendered in the running dev server.
- Some edge-case component matching can require a re-hover after save/reload.
