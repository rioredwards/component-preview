import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import componentPreview from "vite-plugin-component-preview";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), componentPreview()],
});
