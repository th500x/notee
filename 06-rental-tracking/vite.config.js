import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/06-rental-tracking/',
  server: {
    port: 5176,
    open: true
  }
})
