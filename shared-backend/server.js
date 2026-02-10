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
const PORT = process.env.PORT || 3002;

// CORS配置
app.use(cors({
  origin: '*',
  credentials: false,
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
    service: 'shared-backend',
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
  console.log(`🚀 共享后端服务运行在 http://localhost:${PORT}`);
  console.log(`📝 留言板API: http://localhost:${PORT}/api/guestbook`);
  console.log(`💚 健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
