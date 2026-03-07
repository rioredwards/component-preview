import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import vitePluginComponentPreview from "vite-plugin-component-preview";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vitePluginComponentPreview()],
});
