import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/07-coin-index/',
  server: {
    port: 5174,
    proxy: {
      '/api/life-resume': {
        target: 'http://localhost:3011',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api/life-resume': {
        target: 'http://localhost:3011',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})