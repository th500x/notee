import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function offTreeOutDir(bucket) {
  if (process.platform !== 'win32') return 'dist'
  return path.join(path.parse(__dirname).root, 'notee-build', bucket)
}

export default defineConfig({
  plugins: [react()],
  base: '/01-news-calendar/',
  build: {
    outDir: offTreeOutDir('01-news-calendar'),
    emptyOutDir: true,
    assetsDir: 'assets'
  }
})
