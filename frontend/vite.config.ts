import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  // `vite preview` (used by the Playwright e2e run) needs its own proxy; the
  // `server.proxy` above only applies to the dev server. On Vercel, /api is
  // routed by vercel.json instead, so this is local/test-only.
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
