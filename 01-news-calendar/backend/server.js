import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
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
const isProduction = process.env.NODE_ENV === 'production'

// 安全头部配置
// 注意：由于前端是独立的Vite应用，CSP策略会干扰前端运行
// 因此我们禁用CSP，只保留其他安全头部
app.use(helmet({
  contentSecurityPolicy: false, // 禁用CSP，避免干扰前端
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}))

// 限流配置
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: isProduction ? 300 : 1000, // 生产环境300次/15分钟，开发环境1000次
  message: { 
    success: false, 
    error: '请求过于频繁，请稍后再试' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 根据IP限流
  keyGenerator: (req) => {
    return req.clientIP || req.ip
  },
  // 跳过健康检查；新闻 GET 为只读静态 JSON，不计入全局限流
  skip: (req) =>
    req.path === '/health' ||
    (req.method === 'GET' && (req.path === '/news' || req.path.startsWith('/news/')))
})

// Emoji反应的限流（防止刷票，但不能太严格）
const emojiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: isProduction ? 60 : 200, // 生产环境1分钟60次，开发环境200次
  message: { 
    success: false, 
    error: '操作过于频繁，请稍后再试' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.clientIP || req.ip
  },
  // 只对POST请求（添加反应）严格限流
  skip: (req) => req.method === 'GET'
})

// POST请求的严格限流（防止刷票）
const emojiPostLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: isProduction ? 10 : 100, // 生产环境1分钟10次
  message: { 
    success: false, 
    error: '操作过于频繁，请稍后再试' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.clientIP || req.ip
  }
})

// 应用全局限流
app.use('/api/', limiter)

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
    // 生产环境严格检查origin
    if (isProduction) {
      // 允许没有origin的请求（如Postman、服务器端请求）
      if (!origin) return callback(null, true)
      
      // 检查origin是否在允许列表中
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        console.warn('[Security] 拒绝未授权的CORS请求:', origin)
        callback(new Error('Not allowed by CORS'))
      }
    } else {
      // 开发环境允许所有origin
      callback(null, true)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
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

// 日志脱敏函数
function sanitizeLog(data) {
  if (!data || typeof data !== 'object') return data
  
  const sensitive = ['password', 'token', 'api_key', 'secret', 'authorization']
  const sanitized = Array.isArray(data) ? [...data] : { ...data }
  
  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase()
    if (sensitive.some(s => lowerKey.includes(s))) {
      sanitized[key] = '***'
    }
    // 脱敏IP地址（只显示前两段）
    if (lowerKey.includes('ip') && typeof sanitized[key] === 'string') {
      const parts = sanitized[key].split('.')
      if (parts.length === 4) {
        sanitized[key] = `${parts[0]}.${parts[1]}.***.***.***`
      }
    }
  })
  
  return sanitized
}

// 获取真实IP中间件（增强版）
app.use((req, res, next) => {
  // 优先使用X-Forwarded-For（Nginx代理）
  let clientIP = req.headers['x-forwarded-for']
  
  if (clientIP) {
    // X-Forwarded-For可能包含多个IP，取第一个
    clientIP = clientIP.split(',')[0].trim()
  } else {
    // 备用方案
    clientIP = req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               req.ip ||
               '127.0.0.1'
  }
  
  // 处理IPv6的localhost
  if (clientIP === '::1' || clientIP === '::ffff:127.0.0.1') {
    clientIP = '127.0.0.1'
  }
  
  // 验证IP格式
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/
  
  if (!ipv4Regex.test(clientIP) && !ipv6Regex.test(clientIP)) {
    console.warn('[Security] 无效的IP格式:', clientIP)
    clientIP = '0.0.0.0'
  }
  
  req.clientIP = clientIP
  
  // 开发环境记录请求日志
  if (!isProduction) {
    console.log(`[Request] ${req.method} ${req.path} from ${sanitizeLog({ ip: clientIP }).ip}`)
  }
  
  next()
})

// 路由
app.use('/api/news', newsRoutes)
app.use('/api/emoji', emojiLimiter, emojiRoutes) // Emoji GET请求宽松限流

// 为POST请求添加额外的严格限流
app.post('/api/emoji', emojiPostLimiter)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    version: '1.0.0'
  })
})

// 错误处理中间件
app.use((err, req, res, next) => {
  // 记录详细错误（脱敏）
  console.error('[Error]', {
    message: err.message,
    path: req.path,
    method: req.method,
    ip: sanitizeLog({ ip: req.clientIP }).ip,
    timestamp: new Date().toISOString()
  })
  
  // 生产环境返回通用错误信息
  const errorMessage = isProduction 
    ? '服务器内部错误，请稍后重试'
    : err.message || '服务器内部错误'
  
  // CORS错误特殊处理
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      success: false,
      error: '访问被拒绝' 
    })
  }
  
  res.status(err.status || 500).json({ 
    success: false,
    error: errorMessage 
  })
})

// 404处理
app.use('*', (req, res) => {
  console.warn('[404]', {
    path: req.path,
    method: req.method,
    ip: sanitizeLog({ ip: req.clientIP }).ip
  })
  res.status(404).json({ 
    success: false,
    error: '接口不存在' 
  })
})

// 启动服务器
async function startServer() {
  try {
    await initDatabase()
    console.log('✅ 数据库初始化完成')
    
    app.listen(PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`)
      console.log(`🔒 安全模式: ${isProduction ? '生产环境' : '开发环境'}`)
      console.log(`⚡ 全局限流: ${isProduction ? '300次/15分钟' : '1000次/15分钟'}（新闻 GET 除外）`)
      console.log(`🛡️  Emoji GET限流: ${isProduction ? '60次/分钟' : '200次/分钟'}`)
      console.log(`🛡️  Emoji POST限流: ${isProduction ? '10次/分钟' : '100次/分钟'}`)
      console.log(`📊 健康检查: http://localhost:${PORT}/api/health`)
    })
  } catch (error) {
    console.error('启动服务器失败:', error)
    process.exit(1)
  }
}

startServer()