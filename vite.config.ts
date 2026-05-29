import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Vite plugin that mounts the Express API server inside the Vite dev server.
 * This means `npm run dev` starts both the frontend AND the API in one process.
 */
function apiServer(): Plugin {
  return {
    name: 'api-server',
    configureServer(server) {
      // Dynamic import so the module is resolved at runtime, not build-time
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – server/index.js has no type declarations (JS-only module)
      return import('./server/index.js').then(({ app }: { app: import('express').Application }) => {
        server.middlewares.use(app)
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    apiServer(),
  ],
})
