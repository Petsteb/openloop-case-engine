import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Dev: /api is proxied to the FastAPI backend. Production: FastAPI serves web/dist on the same origin.
const target = process.env.VITE_API_TARGET || 'http://localhost:8000'

// Dev only: /client (no slash) would fall back to the bank page; redirect it like FastAPI does in production.
const clientSlash: Plugin = {
  name: 'client-trailing-slash',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ?? ''
      if (url === '/client' || url.startsWith('/client?')) {
        res.statusCode = 302
        res.setHeader('Location', `/client/${url.slice('/client'.length)}`)
        res.end()
        return
      }
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), clientSlash],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Two pages: the bank screen (/) and the client portal (/client/ -> dist/client/index.html).
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        client: fileURLToPath(new URL('./client/index.html', import.meta.url)),
      },
    },
  },
  server: {
    proxy: {
      '/api': { target, changeOrigin: true },
    },
  },
})
