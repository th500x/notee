/**
 * 租赁追踪系统 - 独立后端服务
 * 
 * @description 在端口 3003 运行的租赁追踪 API 服务
 * @module backend/rental-tracking-server
 */

const express = require('express');
const cors = require('cors');
const rentalTrackingRouter = require('./rental-tracking');

const app = express();
const PORT = process.env.PORT || 3003;

// CORS配置 - 支持域名和本地开发
const allowedOrigins = [
  'https://notee.vip',
  'https://www.notee.vip',
  'http://notee.vip',
  'http://www.notee.vip',
  'http://localhost:5176',
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

// 租赁追踪路由（直接挂载到根路径）
app.use('/', rentalTrackingRouter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'rental-tracking',
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
  console.log(`🏠 租赁追踪系统后端服务运行在 http://localhost:${PORT}`);
  console.log(`📊 API端点: http://localhost:${PORT}/projects`);
  console.log(`💚 健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;
