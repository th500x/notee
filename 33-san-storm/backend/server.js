/**
 * 真三风云 - 后端服务器
 * 
 * @description 独立的后端 API 服务，使用MySQL数据库存储数据
 * @module 33-san-storm/backend/server
 * @version 1.0 - MySQL数据库
 */

require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { testConnection, closePool } = require('./database/connection');
const characterRankService = require('./services/characterRankService');
const banditInstanceService = require('./services/banditInstanceService');
const pvpWarService = require('./services/pvpWarService');
const aiKingConfigService = require('./services/aiKingConfigService');
const aiKingActiveDecisionService = require('./services/aiKingActiveDecisionService');
const {
  AiKingHourlyScheduler,
} = require('./services/aiKingHourlyScheduler');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { cronScheduleOptions, GAME_CALENDAR_TZ } = require('./config/gameCalendar');

const CRON_OPTS = cronScheduleOptions();

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

/**
 * PVP / PVE 战事 tick：每 5 分钟扫描 active 战事的 24h 超时等终局条件（17-3 §5 · 17-4 §3）。
 */
function schedulePvpWarTick() {
  cron.schedule(
    '*/5 * * * *',
    async () => {
      try {
        await pvpWarService.tickActivePvpWars();
      } catch (err) {
        console.error('[pvpWar] tick 失败:', err.message);
      }
      try {
        const cityService = require('./services/cityService');
        await cityService.tickActivePveWars();
      } catch (err) {
        console.error('[cityService] PVE war tick 失败:', err.message);
      }
    },
    CRON_OPTS,
  );
}

/**
 * AI 君主主动决策小时调度
 *   - 每分钟扫描所有配置君主的「本小时 slot」是否到点；到点则触发主动决策入口。
 *   - 重启恢复：方案 B（不入库，按剩余时段就地重掷；详见 41-1 §8.1）。
 *   - 与 PVP tick 完全独立；不与被动审批共享随机序列。
 */
function scheduleAiKingHourlyTick() {
  const scheduler = new AiKingHourlyScheduler({
    onFire: async ({ factionId }) => {
      try {
        await aiKingActiveDecisionService.decide({ factionId });
      } catch (err) {
        console.error(`[aiKing][hourly] decide error factionId=${factionId}: ${err.message}`);
      }
    },
  });
  cron.schedule(
    '* * * * *',
    async () => {
      try {
        await scheduler.runMinuteTick();
      } catch (err) {
        console.error('[aiKing][hourly] tick 失败:', err.message);
      }
    },
    CRON_OPTS,
  );
  return scheduler;
}

function scheduleFactionReserveRecoveryDailyTick() {
  const { runDailyReserveRecoveryTick } = require('./services/factionReserveRecoveryService');
  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        const result = await runDailyReserveRecoveryTick();
        if (!result.ok) {
          console.error('[factionReserve] daily tick:', result.error);
          return;
        }
        const n = (result.results || []).length;
        console.log(`[factionReserve] daily tick ${result.date} applied=${n}`);
      } catch (err) {
        console.error('[factionReserve] daily tick 失败:', err.message);
      }
    },
    CRON_OPTS,
  );
}

function scheduleCityAttributeGrowthDailyTick() {
  const { runDailyOwnedCityAttributeGrowthTick } = require('./services/cityAttributeGrowthService');
  const cityService = require('./services/cityService');
  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        const result = await runDailyOwnedCityAttributeGrowthTick();
        if (!result.ok) {
          console.error('[cityAttrGrowth] daily tick:', result.error);
        } else {
          console.log(
            `[cityAttrGrowth] daily tick ${result.date} scanned=${result.scanned} updated=${result.updated} grew=${result.grew} npcSynced=${result.npcSynced || 0}`,
          );
        }
      } catch (err) {
        console.error('[cityAttrGrowth] daily tick 失败:', err.message);
      }
      try {
        const npc = await cityService.runDailyNpcGarrisonRecoveryTick();
        if (!npc.ok) {
          console.error('[npcRecovery] daily tick:', npc.error);
          return;
        }
        console.log(
          `[npcRecovery] daily tick ${npc.date} scanned=${npc.scanned} recovered=${npc.recovered} resurrected=${npc.resurrected}`,
        );
      } catch (err) {
        console.error('[npcRecovery] daily tick 失败:', err.message);
      }
    },
    CRON_OPTS,
  );
}

function scheduleTitlePositionTenureDailyTick() {
  const { runDailyPositionTenureTick } = require('./services/titlePositionTenureService');
  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        const result = await runDailyPositionTenureTick();
        console.log(
          `[titleTenure] daily tick ${result.date} accrued=${result.accrued}/${result.playersWithPosition}`,
        );
      } catch (err) {
        console.error('[titleTenure] daily tick 失败:', err.message);
      }
    },
    CRON_OPTS,
  );
}

function scheduleDailyReportDigestTick() {
  console.log(`[dailyReport] digest cron registered 0 0 * * * tz=${GAME_CALENDAR_TZ}`);
  const { runDailyDigestTick } = require('./services/dailyReportDigestService');
  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        const result = await runDailyDigestTick();
        if (!result.ok) {
          console.error('[dailyReport] digest tick:', result.error);
        }
      } catch (err) {
        console.error('[dailyReport] digest tick 失败:', err.message);
      }
    },
    CRON_OPTS,
  );
}

function scheduleKingDasikongDailyTick() {
  console.log(`[aiKing][dasikong] cron registered 0 0 * * * tz=${GAME_CALENDAR_TZ}`);
  const aiKingDasikongDailyService = require('./services/aiKingDasikongDailyService');
  const aiKingDailyLetterService = require('./services/aiKingDailyLetterService');
  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        logDasikongEnvOnCronFire();
        const result = await aiKingDasikongDailyService.runDailyTick();
        const summary = (result.results || [])
          .map((r) => `${r.factionId}:${r.skipped ? 'skip' : r.bootstrapped ? 'bootstrap' : r.winner?.playerId || r.error || 'none'}`)
          .join('; ');
        console.log(`[aiKing][dasikong] daily tick done ${summary}`);
        for (const r of result.results || []) {
          if (!r.ok || r.error) {
            console.error('[aiKing][dasikong] daily tick faction error', JSON.stringify(r));
          }
        }
      } catch (err) {
        console.error('[aiKing][dasikong] daily tick 失败:', err.message, err.stack || '');
      }
      try {
        const factionWarVoteService = require('./services/factionWarVoteService');
        const voteResult = await factionWarVoteService.runDailyTick();
        console.log(
          `[warVote] daily tick resolve=${(voteResult.resolve?.results || []).length} open=${(voteResult.open?.results || []).length}`,
        );
      } catch (err) {
        console.error('[warVote] daily tick 失败:', err.message, err.stack || '');
      }
      try {
        const letterResult = await aiKingDailyLetterService.runDailyTick();
        const letterSummary = (letterResult.results || [])
          .map((r) => `${r.factionId}:${r.skipped ? 'skip' : r.error || `sent=${r.playerCount || 0}`}`)
          .join('; ');
        console.log(`[aiKing][dailyLetter] daily tick done ${letterSummary}`);
        for (const r of letterResult.results || []) {
          if (!r.ok || r.error) {
            console.error('[aiKing][dailyLetter] daily tick faction error', JSON.stringify(r));
          }
        }
      } catch (err) {
        console.error('[aiKing][dailyLetter] daily tick 失败:', err.message, err.stack || '');
      }
    },
    CRON_OPTS,
  );
}

async function logDasikongEnvOnCronFire() {
  try {
    const { pool } = require('./database/connection');
    const conn = await pool.getConnection();
    try {
      const env = await require('./services/kingDasikongRankingService').getDasikongEnvironmentSnapshot(conn);
      console.log('[aiKing][dasikong] cron fire env', JSON.stringify(env));
    } finally {
      conn.release();
    }
  } catch (e) {
    console.warn('[aiKing][dasikong] cron fire env log failed:', e.message);
  }
}

/** 将领排名快照清理：每天 03:00（东八区自然日） */
function scheduleTempTableCleanup() {
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
    CRON_OPTS,
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
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3004',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3004',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:5177',
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

/** 旧版静态包：单数 /api/player（与 /api/players 并存，见 routes/legacyPlayerApi.js） */
const legacyPlayerApiRouter = require('./routes/legacyPlayerApi');
app.use('/api/player', legacyPlayerApiRouter);

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

const lineupExtraRouter = require('./routes/lineupExtra');
app.use('/api/lineup-extra', lineupExtraRouter);

const adventureRouter = require('./routes/adventure');
app.use('/api/adventure', adventureRouter);

const chapterRouter = require('./routes/chapter');
app.use('/api/chapter', chapterRouter);

/**
 * 管理员：传书模板 config_texts（与前端邮件管理页对接）
 */
const adminConfigTextsRouter = require('./routes/adminConfigTexts');
app.use('/api/admin/config-texts', adminConfigTextsRouter);

const adminWorldMapRouter = require('./routes/adminWorldMap');
app.use('/api/admin/world-map', adminWorldMapRouter);

const adminKingDasikongRouter = require('./routes/adminKingDasikong');
app.use('/api/admin/king-dasikong', adminKingDasikongRouter);

const adminKingDailyLetterRouter = require('./routes/adminKingDailyLetter');
app.use('/api/admin/king-daily-letter', adminKingDailyLetterRouter);

const adminFactionWarVoteRouter = require('./routes/adminFactionWarVote');
app.use('/api/admin/faction-war-vote', adminFactionWarVoteRouter);

/**
 * 管理员：赛季关服切换（设窗口/维护态/自动封档/rollover）；破坏性接口由 SEASON_ROLLOVER_KEY 密钥门禁
 */
const adminSeasonRolloverRouter = require('./routes/adminSeasonRollover');
app.use('/api/admin/season-rollover', adminSeasonRolloverRouter);

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
 * PVP 战术对决房间 API（17-5 §12；二阶段）
 * 须先于 `/api/pvp` 挂载，使更具体的 `/tactical-rooms` 前缀优先匹配。
 */
const pvpTacticalRoomsRouter = require('./routes/pvp/tacticalRooms');
app.use('/api/pvp/tactical-rooms', pvpTacticalRoomsRouter);

/**
 * PVP攻城挑战API
 */
const pvpRouter = require('./routes/pvp');
app.use('/api/pvp', pvpRouter);

/**
 * PVP 势力战事（17-2 M2 · wars_pvp）
 */
const pvpWarsRouter = require('./routes/pvpWars');
app.use('/api/pvp-wars', pvpWarsRouter);

/**
 * 势力政策（11-3 · 长效政策提案 / 朝政面板）
 */
const factionPoliciesRouter = require('./routes/factionPolicies');
app.use('/api/faction-policies', factionPoliciesRouter);

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

let httpServer = null;
let shuttingDown = false;

function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[shutdown] 收到 ${signal}，正在关闭…`);
  const finish = () => {
    closePool().finally(() => process.exit(0));
  };
  if (!httpServer) {
    finish();
    return;
  }
  httpServer.close(() => {
    console.log('[shutdown] HTTP 服务已停止');
    finish();
  });
  setTimeout(() => {
    console.warn('[shutdown] 关闭超时，强制退出');
    finish();
  }, 5000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
}

// 启动服务器
httpServer = app.listen(PORT, async () => {
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
  schedulePvpWarTick();

  // 启动期预加载 AI 君主配置：JSON 解析 / 字段校验失败立即抛错（早失败）。
  try {
    const kings = aiKingConfigService.listAllKings();
    console.log(
      `[aiKing] loaded ${kings.length} kings: ` +
        kings
          .map((k) => `${k.characterName}(${k.factionId}, hourlyDecisions=${k.hourlyDecisions ?? 0})`)
          .join(' / '),
    );
  } catch (err) {
    console.error('[aiKing] 加载 ai-kings.json 失败:', err.message);
  }
  scheduleAiKingHourlyTick();
  scheduleDailyReportDigestTick();
  scheduleFactionReserveRecoveryDailyTick();
  scheduleCityAttributeGrowthDailyTick();
  scheduleTitlePositionTenureDailyTick();
  scheduleKingDasikongDailyTick();

  if (dbConnected) {
    setImmediate(async () => {
      try {
        await new Promise((r) => setTimeout(r, 3000));
        const pveWarBaseCampService = require('./services/pveWarBaseCampService');
        const bf = await pveWarBaseCampService.backfillAllActivePveBaseCamps();
        if (bf.schemaError) {
          console.error(`[pveWarBaseCamp] startup backfill schema: ${bf.schemaError}`);
        } else if (bf.placed > 0) {
          console.log(
            `[pveWarBaseCamp] startup backfill placed=${bf.placed} warsScanned=${bf.wars}`,
          );
        }
      } catch (err) {
        console.warn('[pveWarBaseCamp] startup backfill failed:', err.message);
      }
    });
  }

  if (dbConnected) {
    setImmediate(async () => {
      try {
        const { backfillMissingAccountTypeReal } = require('./services/accountService');
        const backfillRows = await backfillMissingAccountTypeReal();
        if (backfillRows > 0) {
          console.log(`[accounts] backfill account_type=real rows=${backfillRows}`);
        }
      } catch (err) {
        console.error('[accounts] backfill account_type failed:', err.message);
      }
    });
  }

  if (dbConnected) {
    setImmediate(async () => {
      try {
        // 错开启动高峰，避免与玩家首屏 / 纪念图上传争 DB
        await new Promise((r) => setTimeout(r, 15000));
        const aiKingDasikongDailyService = require('./services/aiKingDasikongDailyService');
        const dailyReportDigestService = require('./services/dailyReportDigestService');
        const factionReserveRecoveryService = require('./services/factionReserveRecoveryService');
        const digestCatchUp = await dailyReportDigestService.runStaleCatchUpOnStartup();
        if (digestCatchUp.ok && (digestCatchUp.results || []).some((r) => r.ok && !r.skipped)) {
          console.log('[dailyReport] startup digest catch-up finished');
        }
        const reserveCatchUp = await factionReserveRecoveryService.runStaleCatchUpOnStartup();
        if (reserveCatchUp.ok && (reserveCatchUp.results || []).length > 0) {
          console.log('[factionReserve] startup catch-up finished');
        }
        const cityAttributeGrowthService = require('./services/cityAttributeGrowthService');
        const cityAttrCatchUp = await cityAttributeGrowthService.runStaleCatchUpOnStartup();
        if (cityAttrCatchUp.ok && cityAttrCatchUp.updated > 0) {
          console.log(
            `[cityAttrGrowth] startup catch-up date=${cityAttrCatchUp.date} updated=${cityAttrCatchUp.updated} grew=${cityAttrCatchUp.grew}`,
          );
        }
        const npcCatchUp = cityAttrCatchUp.npcRecovery;
        if (npcCatchUp && npcCatchUp.ok && npcCatchUp.recovered > 0) {
          console.log(
            `[npcRecovery] startup catch-up date=${npcCatchUp.date} recovered=${npcCatchUp.recovered} resurrected=${npcCatchUp.resurrected}`,
          );
        }
        const catchUp = await aiKingDasikongDailyService.runStaleCatchUpOnStartup();
        if (catchUp.ok && (catchUp.results || []).some((r) => r.winner || r.bootstrapped)) {
          console.log('[aiKing][dasikong] startup catch-up finished');
        }
        const aiKingDailyLetterService = require('./services/aiKingDailyLetterService');
        const letterCatchUp = await aiKingDailyLetterService.runStaleCatchUpOnStartup();
        if (letterCatchUp.ok && (letterCatchUp.results || []).some((r) => r.ok && !r.skipped)) {
          console.log('[aiKing][dailyLetter] startup catch-up finished');
        }
        const factionWarVoteService = require('./services/factionWarVoteService');
        const voteCatchUp = await factionWarVoteService.runStaleCatchUpOnStartup();
        if (voteCatchUp.ok) {
          console.log('[warVote] startup catch-up finished');
        }
      } catch (err) {
        console.error('[aiKing][dasikong] startup catch-up failed:', err.message);
      }
    });
  }

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
  console.log(`⏰ 日切 / 定时任务：0:00 与 03:00 按 ${GAME_CALENDAR_TZ}（GMT+8，写死）`);
});

module.exports = app;
