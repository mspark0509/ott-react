import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import fifaLiveHandler from './api/fifa-live.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'fifa-live-development-api',
      configureServer(server) {
        server.middlewares.use('/api/fifa-live', (request, response) => {
          response.status = (code) => { response.statusCode = code; return response }
          response.json = (body) => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(body)); return response }
          void fifaLiveHandler(request, response)
        })
      },
    },
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss()
  ],
})
