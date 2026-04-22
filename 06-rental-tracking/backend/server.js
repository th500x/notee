/**
 * 租赁追踪系统 - 后端服务器（MySQL版本）
 * 
 * @description 独立的后端 API 服务，使用MySQL数据库存储数据
 * @module 06-rental-tracking/backend/server
 * @version 2.0 - MySQL数据库 + OSS照片上传
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: true });
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./database/connection');

const app = express();
const PORT = process.env.PORT || 3003;

// CORS配置 - 开发环境允许所有来源
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// ==================== 注册路由 ====================

/**
 * 租赁追踪API路由（MySQL版本）
 * 统一使用 /api/ 前缀，与其他项目保持一致
 */
const rentalTrackingRouter = require('./rental-tracking-mysql');
app.use('/api/rental-tracking', rentalTrackingRouter);

/**
 * 照片上传路由（OSS）
 */
const uploadRouter = require('./routes/upload');
app.use('/api/upload', uploadRouter);

/**
 * 数据同步路由
 */
const syncRouter = require('./routes/sync');
app.use('/api/rental-tracking/sync', syncRouter);

/**
 * 健康检查
 */
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({ 
    status: dbConnected ? 'ok' : 'degraded', 
    service: 'rental-tracking',
    version: '2.0-mysql',
    storage: 'MySQL',
    photo: 'OSS',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

// 启动服务器
app.listen(PORT, async () => {
  console.log('========================================');
  console.log('🏠 租赁追踪系统后端服务');
  console.log('========================================');
  console.log(`🌐 服务地址: http://localhost:${PORT}`);
  console.log(`📊 API端点: http://localhost:${PORT}/api/rental-tracking`);
  console.log(`📷 照片上传: http://localhost:${PORT}/api/upload/photos`);
  console.log(`💚 健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('📦 存储配置:');
  console.log(`   🗄️  数据库: MySQL (${process.env.DB_NAME || '06_rental_tracking'})`);
  console.log(`   ☁️  照片: 阿里云OSS (${process.env.OSS_BUCKET || '06-rental-tracking'})`);
  console.log('');
  
  // 测试数据库连接
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.log('⚠️  警告: 数据库连接失败，请检查配置');
  }
  
  console.log('========================================');
  console.log('✅ 服务器启动成功！');
  console.log('========================================');
  console.log('');
});

module.exports = app;
