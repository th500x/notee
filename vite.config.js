import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appListDir = path.resolve(__dirname, '00-notee-app')

function appListFile(urlPath) {
  if (urlPath !== '/00-notee-app' && !urlPath.startsWith('/00-notee-app/')) return null
  let rel = decodeURIComponent(urlPath.slice('/00-notee-app'.length))
  if (rel === '' || rel === '/') rel = '/index.html'
  const file = path.resolve(appListDir, `.${rel}`)
  const root = appListDir.endsWith(path.sep) ? appListDir : `${appListDir}${path.sep}`
  if (file !== appListDir && !file.startsWith(root)) return null
  const inside = path.relative(appListDir, file).replace(/\\/g, '/')
  const allowed = inside === 'index.html' || (inside.startsWith('privacy/') && inside.endsWith('.html'))
  if (!allowed) return null
  return file
}

/** 应用列表是静态页。开发时直接读源文件；构建时放进主站 dist，现有站点根目录就能打开。 */
function noteeAppList() {
  const serve = (req, res, next) => {
    const urlPath = req.url?.split('?')[0]
    const file = urlPath ? appListFile(urlPath) : null
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      next()
      return
    }
    res.statusCode = 200
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(readFileSync(file))
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
      mkdirSync(path.join(dest, 'privacy'), { recursive: true })
      cpSync(path.join(appListDir, 'index.html'), path.join(dest, 'index.html'))
      cpSync(path.join(appListDir, 'privacy'), path.join(dest, 'privacy'), { recursive: true })
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
