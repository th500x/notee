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

export default defineConfig({
  plugins: [react(), siteFontDevPlugin(path.resolve(__dirname, '..'))],
  base: '/03-lost-pearls/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5180,
    fs: {
      allow: [__dirname],
    },
  },
  build: {
    outDir: offTreeOutDir('03-lost-pearls'),
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
  },
})
