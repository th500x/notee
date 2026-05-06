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
const cron = require('node-cron');
const { testConnection } = require('./database/connection');
const characterRankService = require('./services/characterRankService');
const banditInstanceService = require('./services/banditInstanceService');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

/**
 * 启动期硬性检查：JWT_SECRET 缺失 / 过短即拒绝启动。
 * 与 `middleware/auth.js` 一致；不允许"开发期默认 secret"静默兜底（见 `notee-code-quality-and-debugging.mdc` §1）。
 *
 * 例外：仅当 **本地开发期** 同时满足 `NODE_ENV !== 'production'` 与 `JWT_DEV_BYPASS=1` 时，
 *      允许 JWT_SECRET 缺失（此时 `requireAuth` 走 `tryDevBypass` 兜底，不会调用 `jwt.verify`）。
 *      生产环境下 `JWT_DEV_BYPASS` 永远被忽略；本启动检查仍按生产标准强制 JWT_SECRET。
 */
function assertJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV !== 'production' && process.env.JWT_DEV_BYPASS === '1') {
      console.warn('[startup] ⚠️  JWT_DEV_BYPASS=1 已启用，跳过 JWT_SECRET 启动检查（仅本地开发期）');
      return;
    }
    console.error('========================================');
    console.error('❌ 启动失败：JWT_SECRET 未配置或过短');
    console.error('   请在 backend/.env 内设置至少 16 字符的 JWT_SECRET');
    console.error('   参考：JWT_SECRET=$(openssl rand -hex 32)');
    console.error('   或本地开发期：在 backend/.env 内加 JWT_DEV_BYPASS=1（仅 NODE_ENV!=production 生效）');
    console.error('========================================');
    process.exit(1);
  }
}
assertJwtSecret();

/** 与 01-1-DATABASE_DESIGN.md 临时表清理示例一致：每天凌晨 3:00（默认进程本地时区；生产可设 CRON_TZ=Asia/Shanghai） */
function scheduleTempTableCleanup() {
  const tz = process.env.CRON_TZ;
  const opts = tz ? { timezone: tz } : {};
  cron.schedule(
    '0 3 * * *',
    async () => {
      try {
        const { affectedRows } = await characterRankService.deleteExpiredSnapshots();
        if (affectedRows > 0) {
          console.log(`[CharacterRank] 已清理过期快照 ${affectedRows} 条（14 天未刷新）`);
        }
      } catch (err) {
        console.error('[CharacterRank] 清理过期快照失败:', err.message);
      }
    },
    opts
  );
}

const app = express();
// Nginx 反代必设：否则 express-rate-limit v8 检测到 X-Forwarded-For 但 trust proxy 为默认 false 时会校验失败抛错，登录等 POST 表现为 500。
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3005;

/**
 * CORS 收口（必改 #1）：
 *   - 默认白名单含本地常用端口 + notee.vip 正式域（与 `.env.example` 示例一致）。
 *   - 生产另有域名时用 .env `CORS_ALLOWED_ORIGINS=...` **覆盖整份白名单**。
 *   - 无 Origin 头一律放行（curl / 部分同源 GET）。
 */
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3002',
  'http://localhost:3004',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3004',
  'https://notee.vip',
  'https://www.notee.vip',
];
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ORIGIN_WHITELIST = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_DEV_ORIGINS;

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ORIGIN_WHITELIST.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

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

const adminWorldMapRouter = require('./routes/adminWorldMap');
app.use('/api/admin/world-map', adminWorldMapRouter);

/**
 * 纪念图（MVP：Battle）
 */
const memorialRouter = require('./routes/memorial');
app.use('/api/memorial', memorialRouter);

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
 * 战役地图 preset（与 shared/data/campaign 同步）
 */
const campaignMapsRouter = require('./routes/campaignMaps');
app.use('/api/campaign', campaignMapsRouter);

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

app.use(notFoundHandler);
app.use(errorHandler);

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

  scheduleTempTableCleanup();

  /**
   * 匪寨同步异步后置（CR P2，2026-04-29）：
   * 原实现把 `syncBanditsFromYingchuanMergedDisk()` 放在 `app.listen` 回调内 `await`，
   * 导致冷启动时若该同步耗时 / 报错（合并图磁盘抖动、表不存在等），"✅ 服务器启动成功" 提示会被
   * 推迟，反复重启时易让人误以为后端没起。改用 `setImmediate` 让 listen 回调立即完成，
   * 同步任务在事件循环下一轮跑；任何失败仅 console.warn，**不**影响 HTTP 服务可用性。
   */
  if (dbConnected) {
    setImmediate(async () => {
      try {
        const sync = await banditInstanceService.syncBanditsFromYingchuanMergedDisk();
        if (sync.ok && sync.ensured > 0) {
          console.log(
            `[Bandits] 已与合并图对齐：新增 ${sync.ensured} 行，POI=${(sync.banditIds || []).join(',')}（source=${sync.source || 'cells'}）`,
          );
        }
      } catch (e) {
        console.warn('[Bandits] 启动时同步失败（可稍后执行 node scripts/sync-bandits-from-merged-map.js）:', e.message);
      }
    });
  }
  const tzHint = process.env.CRON_TZ ? `CRON_TZ=${process.env.CRON_TZ}` : '本地时区';
  console.log(`⏰ 将领排名快照清理：每日 03:00（${tzHint}），与数据库设计文档临时表清理节奏一致`);
});

module.exports = app;
