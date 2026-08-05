import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendPort = process.env.PI_LIVECRAFT_BACKEND_PORT ?? '43121'
const host = process.env.PI_LIVECRAFT_HOST ?? '127.0.0.1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host,
    proxy: {
      '/api': `http://127.0.0.1:${backendPort}`,
    },
  },
})
