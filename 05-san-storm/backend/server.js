/**
 * 真三风云 - 后端服务器
 * 
 * @description 独立的后端 API 服务，使用MySQL数据库存储数据
 * @module 05-san-storm/backend/server
 * @version 1.0 - MySQL数据库
 */

require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./database/connection');

const app = express();
const PORT = process.env.PORT || 3005;

// CORS配置 - 开发环境允许所有来源
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// 与生产 nginx 一致：前端 PROD 下请求 /api/san-storm/*，本地直连 3005 时无代理则补一层前缀剥离
app.use((req, res, next) => {
  const prefix = '/api/san-storm';
  if (req.url === prefix || req.url.startsWith(`${prefix}/`) || req.url.startsWith(`${prefix}?`)) {
    req.url = req.url.replace(prefix, '/api') || '/';
  }
  next();
});

// ==================== 注册路由 ====================

/**
 * 认证路由（注册、登录）
 */
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

/**
 * 服务器路由（服务器列表）
 */
const serverRouter = require('./routes/servers');
app.use('/api/servers', serverRouter);

/**
 * 玩家路由（角色创建、玩家信息）
 */
const playerRouter = require('./routes/players');
app.use('/api/players', playerRouter);

/**
 * 配置数据路由（将领、部队、技能等）
 */
const configRouter = require('./routes/config');
app.use('/api/config', configRouter);

/**
 * 战斗记录路由（保存、查询、收藏）
 */
const battlesRouter = require('./routes/battles');
app.use('/api/battles', battlesRouter);

/**
 * 卡池抽取路由（临时模拟方案）
 */
const cardPoolRouter = require('./routes/cardPool');
app.use('/api/card-pool', cardPoolRouter);

/**
 * 排行榜路由（活动排名）
 */
const rankingsRouter = require('./routes/rankings');
app.use('/api/rankings', rankingsRouter);

/**
 * 城市路由（城市信息、攻城、归属）
 */
const citiesRouter = require('./routes/cities');
app.use('/api/cities', citiesRouter);

/**
 * 驻守系统API
 */
const garrisonsRouter = require('./routes/garrisons');
app.use('/api/garrisons', garrisonsRouter);

/**
 * 管理员：传书模板 config_texts（与前端邮件管理页对接）
 */
const adminConfigTextsRouter = require('./routes/adminConfigTexts');
app.use('/api/admin/config-texts', adminConfigTextsRouter);

/**
 * 聊天（天下 / 势力 / 军团）
 */
const chatsRouter = require('./routes/chats');
app.use('/api/chats', chatsRouter);

/**
 * PVP攻城挑战API
 */
const pvpRouter = require('./routes/pvp');
app.use('/api/pvp', pvpRouter);

/**
 * 健康检查
 */
app.get('/api/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({ 
    status: dbConnected ? 'ok' : 'degraded', 
    service: 'san-storm',
    version: '1.0-mysql',
    storage: 'MySQL',
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
  console.log('⚔️  真三风云后端服务');
  console.log('========================================');
  console.log(`🌐 服务地址: http://localhost:${PORT}`);
  console.log(`📊 API端点: http://localhost:${PORT}/api`);
  console.log(`💚 健康检查: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('📦 存储配置:');
  console.log(`   🗄️  数据库: MySQL (${process.env.DB_NAME || '05_san_storm'})`);
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
