import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/02-tale-historical/',
  server: {
    port: 5174
  },
  build: {
    sourcemap: false // 禁用 source map 以避免警告
  }
})