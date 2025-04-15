import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost',
      protocol: 'ws',
      port: 5173,
      timeout: 60000
    },
    watch: {
      usePolling: true
    },
    cors: true,
    allowedHosts: [
      'localhost',
      'recordings-polyphonic-purchasing-wildlife.trycloudflare.com',
      'incredible-pressed-reading-develop.trycloudflare.com',
      'valid-vanilla-virgin-sofa.trycloudflare.com'
    ],
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
})