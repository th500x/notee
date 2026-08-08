/**
 * Daily: purge expired posts + freeze previous UTC+7 month board.
 */

const cron = require('node-cron');
const { purgeExpiredPosts } = require('../services/ttlService');
const { freezePreviousMonthIfNeeded } = require('../services/boardService');

async function runDailyMaintenance(reason = 'manual') {
  console.log(`[one-line/jobs] daily start (${reason})`);
  try {
    const ttl = await purgeExpiredPosts();
    console.log(`[one-line/jobs] ttl purged=${ttl.purged}`);
  } catch (err) {
    console.error('[one-line/jobs] ttl failed:', err.message);
  }
  try {
    const board = await freezePreviousMonthIfNeeded();
    console.log(
      `[one-line/jobs] board month=${board.monthKey} count=${board.count} newlyFrozen=${board.frozen}`
    );
  } catch (err) {
    console.error('[one-line/jobs] board freeze failed:', err.message);
  }
}

/**
 * Schedule 00:15 Asia/Bangkok daily; also catch-up once shortly after boot.
 */
function startDailyMaintenanceJobs() {
  cron.schedule(
    '15 0 * * *',
    () => {
      runDailyMaintenance('cron').catch((err) => {
        console.error('[one-line/jobs] cron error:', err.message);
      });
    },
    { timezone: 'Asia/Bangkok' }
  );
  console.log('[one-line/jobs] scheduled 00:15 Asia/Bangkok (TTL + month board)');

  setTimeout(() => {
    runDailyMaintenance('startup').catch((err) => {
      console.error('[one-line/jobs] startup error:', err.message);
    });
  }, 3000);
}

module.exports = {
  runDailyMaintenance,
  startDailyMaintenanceJobs,
};
