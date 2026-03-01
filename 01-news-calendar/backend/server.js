import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { initDatabase } from './database.js'
import newsRoutes from './routes/news.js'
import emojiRoutes from './routes/emoji.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3002

// CORS配置 - 支持域名和本地开发
const allowedOrigins = [
  'https://notee.vip',
  'https://www.notee.vip',
  'http://notee.vip',
  'http://www.notee.vip',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://47.113.185.170'
]

app.use(cors({
  origin: function (origin, callback) {
    // 允许没有origin的请求（如Postman、服务器端请求）
    if (!origin) return callback(null, true)
    
    // 检查origin是否在允许列表中
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      // 开发环境允许所有origin
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Cache-Control',
    'Pragma',
    'Accept',
    'Origin'
  ]
}))

// 解析JSON
app.use(express.json({ limit: '10mb' }))

// 获取IP中间件
app.use((req, res, next) => {
  req.clientIP = req.headers['x-forwarded-for'] || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress ||
                 '127.0.0.1'
  
  if (req.clientIP === '::1') {
    req.clientIP = '127.0.0.1'
  }
  
  next()
})

// 路由 - 完全无限制
app.use('/api/news', newsRoutes)
app.use('/api/emoji', emojiRoutes)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    ip: req.clientIP,
    message: '完全无限流限制版本'
  })
})

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({ error: '服务器内部错误' })
})

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

// 启动服务器
async function startServer() {
  try {
    await initDatabase()
    console.log('✅ 数据库初始化完成 - 无任何限流限制')
    
    app.listen(PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`)
      console.log(`🔓 完全无限流限制版本`)
      console.log(`📊 健康检查: http://localhost:${PORT}/api/health`)
    })
  } catch (error) {
    console.error('启动服务器失败:', error)
    process.exit(1)
  }
}

startServer()