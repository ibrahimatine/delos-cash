import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('./web/', import.meta.url))

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^\/web\//, replacement: root },
      { find: '@signals', replacement: fileURLToPath(new URL('./web/lib/reactive.ts', import.meta.url)) },
    ],
  },
  server: {
    port: 8000,
    proxy: {
      '/api': { target: 'http://localhost:8001', changeOrigin: false },
    },
  },
  define: { 'globalThis.DELOS_BUILD': JSON.stringify(String(Date.now())) },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
