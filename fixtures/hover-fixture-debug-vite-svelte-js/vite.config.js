import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import vitePluginComponentPreview from "vite-plugin-component-preview";

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), vitePluginComponentPreview()],
});
