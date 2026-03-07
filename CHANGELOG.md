# Changelog

All notable changes to Component Preview are documented in this file.

## [0.1.0] - 2026-03-07

### What works

- Hover preview for `.html` files.
- Hover preview for `.tsx` / `.jsx` files (out-of-the-box fallback path).
- Vue/Svelte preview support via `vite-plugin-component-preview`.
- Optional `component-preview.devServerUrl` override for custom dev server URLs.
- Marketplace-ready README media and packaging scripts.

### Known limitations

- Vue/Svelte require plugin setup and dev server restart after config changes.
- Preview depends on your app being actively rendered in the running dev server.
- Some edge-case component matching can require a re-hover after save/reload.

## [Unreleased]

- Ongoing reliability and UX improvements.
