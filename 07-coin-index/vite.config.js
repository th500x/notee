import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { siteFontDevPlugin } from '../shared/viteSiteFont.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function offTreeOutDir(bucket) {
  if (process.platform !== 'win32') return 'dist'
  return path.join(path.parse(__dirname).root, 'notee-build', bucket)
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), siteFontDevPlugin(path.resolve(__dirname, '..'))],
  base: '/07-coin-index/',
  server: {
    port: 5174,
    proxy: {
      '/api/life-resume': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api/life-resume': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: offTreeOutDir('07-coin-index'),
    emptyOutDir: true,
    assetsDir: 'assets'
  }
})