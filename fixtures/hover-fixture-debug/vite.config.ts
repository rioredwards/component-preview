import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import componentPreview from 'vite-plugin-component-preview'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), componentPreview()],
})
