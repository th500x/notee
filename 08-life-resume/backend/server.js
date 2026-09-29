/**
 * 全站 00 后端（端口 3001）。
 * 1. 管理员口令 /api/auth
 * 2. 人生片段 /api/life-resume（原 11 的全部接口）
 * 数据库名仍是 11_life_resume，海外搬迁前不改。
 */

const path = require('path');
const dotenv = require('dotenv');

const portFromProcess = process.env.PORT;
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local'), override: true });
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.join(__dirname, '.env.production'), override: true });
}
if (portFromProcess) {
  process.env.PORT = portFromProcess;
}

const express = require('express');
const cors = require('cors');
const { testConnection, testAccountsConnection, dbConfig } = require('./database/connection');
const lifeResumeRouter = require('./routes/lifeResume');
const authRouter = require('./routes/auth');
const adminAuthRouter = require('./routes/adminAuth');
const profilesRouter = require('./routes/profiles');
const entriesRouter = require('./routes/entries');
const uploadRouter = require('./routes/upload');
const locationRouter = require('./routes/location');
const homeRouter = require('./routes/home');
const lifePathRouter = require('./routes/lifePath');
const entrySeriesRouter = require('./routes/entrySeries');
const pushRouter = require('./routes/push');
const ethMaCrossRouter = require('./routes/ethMaCross');
const walletAssetsRouter = require('./routes/walletAssets');
const { assertJwtSecret, loadLegacyAdminEnv, assertAdminAuthConfig } = require('./utils/startupChecks');
const { adminLoginLimiter } = require('./middleware/rateLimit');
const { startWalletAssetDailyJob } = require('./services/walletAssetDailyJob');

loadLegacyAdminEnv();
assertJwtSecret();
assertAdminAuthConfig();

if (portFromProcess) {
  process.env.PORT = portFromProcess;
}

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Nginx 反代时须开启，否则 req.ip 不准且 express-rate-limit v8 可能因 X-Forwarded-For 报错
app.set('trust proxy', 1);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Eth-Ma-Ingest-Secret'],
  })
);

app.use(express.json({ limit: '10mb' }));

app.use('/api/auth/login', adminLoginLimiter);
app.use('/api/auth', adminAuthRouter);

app.use('/api/life-resume', lifeResumeRouter);
app.use('/api/life-resume/auth', authRouter);
app.use('/api/life-resume/profiles/me/life-path', lifePathRouter);
app.use('/api/life-resume/profiles', profilesRouter);
app.use('/api/life-resume/entries', entriesRouter);
app.use('/api/life-resume/upload', uploadRouter);
app.use('/api/life-resume/location', locationRouter);
app.use('/api/life-resume/home', homeRouter);
app.use('/api/life-resume/entry-series', entrySeriesRouter);
app.use('/api/life-resume/push', pushRouter);
app.use('/api/life-resume/eth-ma-cross', ethMaCrossRouter);
app.use('/api/life-resume/wallet-assets', walletAssetsRouter);

async function healthHandler(req, res) {
  const dbConnected = await testConnection();
  const accountsDbConnected = await testAccountsConnection();
  const ok = dbConnected && accountsDbConnected;
  res.json({
    success: true,
    status: ok ? 'ok' : 'degraded',
    service: 'notee-backend',
    adminAuth: Boolean(process.env.ADMIN_JWT_SECRET && process.env.GLOBAL_PASSWORD_HASH),
    lifeResume: true,
    database: dbConnected ? 'connected' : 'disconnected',
    databaseName: dbConfig.database,
    accountsDatabase: accountsDbConnected ? 'connected' : 'disconnected',
    accountsDatabaseName: dbConfig.database,
    timestamp: new Date().toISOString(),
  });
}

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.use((err, req, res, next) => {
  console.error('[life-resume]', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.listen(PORT, async () => {
  console.log('========================================');
  console.log('00 notee 后端（管理员口令 + 人生片段）');
  console.log('========================================');
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`💚 /health`);
  console.log(`🔐 /api/auth`);
  console.log(`📊 /api/life-resume`);
  console.log(`🔐 /api/life-resume/auth`);
  console.log(`🔔 /api/life-resume/push`);
  console.log(`📈 /api/life-resume/eth-ma-cross`);
  console.log(`🗄️  DB: ${dbConfig.database} @ ${dbConfig.host}:${dbConfig.port}`);
  console.log(`🪪  Accounts: ${dbConfig.database}.accounts`);

  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.log('⚠️  业务库未连接（执行 npm run db:migrate 后重试）');
  }
  const accountsDbConnected = await testAccountsConnection();
  if (!accountsDbConnected) {
    console.log('⚠️  本库 accounts 表不可用（请先 npm run db:migrate，再生产再跑 accounts:copy-from-san-storm）');
  }

  console.log('========================================');
  startWalletAssetDailyJob();
});

module.exports = app;
