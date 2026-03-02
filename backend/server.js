/**
 * 共享后端服务
 * 
 * @description 为主页提供留言板等共享功能的API服务
 * @module shared-backend/server
 */

// 加载环境变量
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const guestbookRouter = require('./guestbook');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS配置 - 支持域名和本地开发
const allowedOrigins = [
  'https://notee.vip',
  'https://www.notee.vip',
  'http://notee.vip',
  'http://www.notee.vip',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  'http://47.113.185.170'
];

app.use(cors({
  origin: function (origin, callback) {
    // 允许没有origin的请求
    if (!origin) return callback(null, true);
    
    // 检查origin是否在允许列表中
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // 开发环境允许所有origin
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 解析JSON
app.use(express.json({ limit: '1mb' }));

// Rate Limiting配置
// 全局限流：每15分钟最多100个请求
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100个请求
  message: { 
    success: false, 
    error: '请求过于频繁，请稍后再试' 
  },
  standardHeaders: true, // 返回 RateLimit-* 头部
  legacyHeaders: false, // 禁用 X-RateLimit-* 头部
});

// 留言板写操作限流：每分钟最多5个请求
const guestbookWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 5, // 最多5个请求
  message: { 
    success: false, 
    error: '提交过于频繁，请稍后再试' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 只对POST和DELETE请求限流
  skip: (req) => req.method === 'GET'
});

// 登录限流：每15分钟最多10次尝试
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 最多10次尝试
  message: { 
    success: false, 
    error: '登录尝试过多，请15分钟后再试' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 应用全局限流
app.use('/api/', globalLimiter);

// 留言板路由（带写操作限流）
app.use('/api/guestbook', guestbookWriteLimiter, guestbookRouter);

// 全局认证路由（带登录限流）
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'notee-backend',
    timestamp: new Date().toISOString(),
    features: ['guestbook', 'auth']
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    error: '服务器内部错误' 
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: '接口不存在' 
  });
});

// 生产环境检查
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'notee-default-secret-change-this') {
    console.error('❌ 错误: 生产环境必须设置自定义 JWT_SECRET 环境变量');
    console.error('请在 .env 文件中设置: JWT_SECRET=your-secret-key');
    process.exit(1);
  }
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Notee 后端服务运行在 http://localhost:${PORT}`);
  console.log(`📝 留言板API: http://localhost:${PORT}/api/guestbook`);
  console.log(`🔐 认证API: http://localhost:${PORT}/api/auth`);
  console.log(`💚 健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
