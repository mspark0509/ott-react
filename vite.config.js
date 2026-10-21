import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import fifaLiveHandler from './api/fifa-live.js'
import baseballLiveHandler from './api/baseball-live.js'
import baseballStatusHandler from './api/baseball-status.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'fifa-live-development-api',
      configureServer(server) {
        for (const [path, handler] of [['/api/fifa-live', fifaLiveHandler], ['/api/baseball-live', baseballLiveHandler], ['/api/baseball-status', baseballStatusHandler]]) {
          server.middlewares.use(path, (request, response) => {
            response.status = (code) => { response.statusCode = code; return response }
            response.json = (body) => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(body)); return response }
            void handler(request, response)
          })
        }
      },
    },
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss()
  ],
})
