import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3002',
        ws: true
      },
      '/translate': 'http://localhost:3002',
      '/debug': 'http://localhost:3002'
    }
  }
})
