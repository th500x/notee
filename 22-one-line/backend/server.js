/**
 * 22-one-line backend — Notee Go One Line / 今日一句 (port 3022).
 * Phase 5: + TTL purge + monthly board. Phase 7: + login id sign-up / sign-in.
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
const { assertJwtSecret } = require('./utils/startupChecks');
const { startDailyMaintenanceJobs } = require('./jobs/dailyMaintenance');
const onelineRouter = require('./routes/oneline');

assertJwtSecret();

const app = express();
const PORT = parseInt(process.env.PORT || '3022', 10);

app.set('trust proxy', 1);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '32kb' }));

app.use('/api/oneline', onelineRouter);

app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({
    success: true,
    status: dbConnected ? 'ok' : 'degraded',
    service: 'one-line',
    phase: 'P5',
    database: dbConnected ? 'connected' : 'disconnected',
    databaseName: dbConfig.database,
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  console.error('[one-line]', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.listen(PORT, async () => {
  console.log('========================================');
  console.log('✏️  22-one-line 后端 (One Line)');
  console.log('========================================');
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`💚 /health`);
  console.log(`📊 /api/oneline/health`);
  console.log(`🔑 /api/oneline/auth/anonymous · login-id/candidates · register · login`);
  console.log(`👤 /api/oneline/me`);
  console.log(`📝 /api/oneline/posts · /feed · board · blocks`);
  console.log(`🗄️  DB: ${dbConfig.database} @ ${dbConfig.host}:${dbConfig.port}`);

  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.log('⚠️  数据库未连接（配置 .env 后 npm run db:migrate）');
  } else if (process.env.DISABLE_CRON !== '1') {
    startDailyMaintenanceJobs();
  } else {
    console.log('[one-line/jobs] DISABLE_CRON=1 — skipped');
  }

  console.log('========================================');
});

module.exports = app;
