/**
 * 共享后端服务
 * 
 * @description 为主页提供留言板等共享功能的API服务
 * @module shared-backend/server
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const guestbookRouter = require('./guestbook');

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

// 留言板路由
app.use('/api/guestbook', guestbookRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'notee-backend',
    timestamp: new Date().toISOString()
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

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Notee 后端服务运行在 http://localhost:${PORT}`);
  console.log(`📝 留言板API: http://localhost:${PORT}/api/guestbook`);
  console.log(`💚 健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
