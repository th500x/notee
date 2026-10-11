import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function offTreeOutDir(bucket) {
  if (process.platform !== 'win32') return 'dist'
  return path.join(path.parse(__dirname).root, 'notee-build', bucket)
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/06-rental-tracking/',
  server: {
    port: 5176,
    open: true
  },
  build: {
    outDir: offTreeOutDir('06-rental-tracking'),
    emptyOutDir: true
  }
})
