import fs from 'node:fs'
import path from 'node:path'

/**
 * 子项目 dev server 没有主站的 public/。
 * 页面用绝对路径 /fonts/JYHPHS.woff2，这里从仓库 public/fonts 读出来。
 */
export function siteFontDevPlugin(repoRoot) {
  const fontFile = path.join(repoRoot, 'public', 'fonts', 'JYHPHS.woff2')
  return {
    name: 'notee-site-font',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : ''
        if (url !== '/fonts/JYHPHS.woff2') return next()
        if (!fs.existsSync(fontFile)) return next()
        const stat = fs.statSync(fontFile)
        res.setHeader('Content-Type', 'font/woff2')
        res.setHeader('Content-Length', stat.size)
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        if (req.method === 'HEAD') {
          res.end()
          return
        }
        fs.createReadStream(fontFile).pipe(res)
      })
    },
  }
}
