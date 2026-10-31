import { cpSync, mkdirSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appListFile = path.resolve(__dirname, '00-notee-app/index.html')

/** 应用列表是静态页。开发时直接读源文件；构建时放进主站 dist，现有站点根目录就能打开。 */
function noteeAppList() {
  const serve = (req, res, next) => {
    const url = req.url?.split('?')[0]
    if (url !== '/00-notee-app' && url !== '/00-notee-app/') {
      next()
      return
    }
    res.statusCode = 200
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(readFileSync(appListFile))
  }
  return {
    name: 'notee-app-list',
    configureServer(server) {
      server.middlewares.use(serve)
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve)
    },
    closeBundle() {
      const dest = path.join(offTreeOutDir('notee'), '00-notee-app')
      mkdirSync(dest, { recursive: true })
      cpSync(appListFile, path.join(dest, 'index.html'))
    },
  }
}

function offTreeOutDir(bucket) {
  if (process.platform !== 'win32') return 'dist'
  return path.join(path.parse(__dirname).root, 'notee-build', bucket)
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), noteeAppList()],
  base: '/',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: offTreeOutDir('notee'),
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false
  }
})
