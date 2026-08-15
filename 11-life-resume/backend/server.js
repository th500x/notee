/**
 * 11-life-resume backend (port 3011).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: true });
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: path.join(__dirname, '.env.production'), override: true });
}

const express = require('express');
const cors = require('cors');
const { testConnection, dbConfig } = require('./database/connection');
const { testAccountsConnection, accountsDbConfig } = require('./database/sanStormAccountsConnection');
const lifeResumeRouter = require('./routes/lifeResume');
const authRouter = require('./routes/auth');
const profilesRouter = require('./routes/profiles');
const entriesRouter = require('./routes/entries');
const uploadRouter = require('./routes/upload');
const locationRouter = require('./routes/location');
const homeRouter = require('./routes/home');
const lifePathRouter = require('./routes/lifePath');
const entrySeriesRouter = require('./routes/entrySeries');
const { assertJwtSecret } = require('./utils/startupChecks');

assertJwtSecret();

const app = express();
const PORT = parseInt(process.env.PORT || '3011', 10);

// Nginx 反代时须开启，否则 req.ip 不准且 express-rate-limit v8 可能因 X-Forwarded-For 报错
app.set('trust proxy', 1);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));

app.use('/api/life-resume', lifeResumeRouter);
app.use('/api/life-resume/auth', authRouter);
app.use('/api/life-resume/profiles/me/life-path', lifePathRouter);
app.use('/api/life-resume/profiles', profilesRouter);
app.use('/api/life-resume/entries', entriesRouter);
app.use('/api/life-resume/upload', uploadRouter);
app.use('/api/life-resume/location', locationRouter);
app.use('/api/life-resume/home', homeRouter);
app.use('/api/life-resume/entry-series', entrySeriesRouter);

app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  const accountsDbConnected = await testAccountsConnection();
  const ok = dbConnected && accountsDbConnected;
  res.json({
    success: true,
    status: ok ? 'ok' : 'degraded',
    service: 'life-resume',
    phase: 'P13',
    database: dbConnected ? 'connected' : 'disconnected',
    databaseName: dbConfig.database,
    accountsDatabase: accountsDbConnected ? 'connected' : 'disconnected',
    accountsDatabaseName: accountsDbConfig.database,
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  console.error('[life-resume]', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.listen(PORT, async () => {
  console.log('========================================');
  console.log('📖 11-life-resume 后端');
  console.log('========================================');
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`💚 /health`);
  console.log(`📊 /api/life-resume`);
  console.log(`🔐 /api/life-resume/auth`);
  console.log(`🗄️  DB: ${dbConfig.database} @ ${dbConfig.host}:${dbConfig.port}`);
  console.log(`🪪  Accounts: ${accountsDbConfig.database} @ ${accountsDbConfig.host}:${accountsDbConfig.port}`);

  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.log('⚠️  业务库未连接（执行 npm run db:migrate 后重试）');
  }
  const accountsDbConnected = await testAccountsConnection();
  if (!accountsDbConnected) {
    console.log('⚠️  账号库未连接（登录/注册需要能读 05_san_storm.accounts）');
  }

  console.log('========================================');
});

module.exports = app;
