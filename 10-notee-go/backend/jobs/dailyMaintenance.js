/**
 * Daily: purge expired posts + freeze previous UTC+7 month board.
 */

const cron = require('node-cron');
const { purgeExpiredPosts } = require('../services/ttlService');
const { freezePreviousMonthIfNeeded } = require('../services/boardService');
const { purgeIdleSilentAccounts } = require('../services/userService');

async function runDailyMaintenance(reason = 'manual') {
  console.log(`[notee-go/jobs] daily start (${reason})`);
  try {
    const ttl = await purgeExpiredPosts();
    console.log(`[notee-go/jobs] ttl purged=${ttl.purged}`);
  } catch (err) {
    console.error('[notee-go/jobs] ttl failed:', err.message);
  }
  try {
    const silent = await purgeIdleSilentAccounts();
    console.log(`[notee-go/jobs] silent idle purged=${silent.purged}`);
  } catch (err) {
    console.error('[notee-go/jobs] silent idle failed:', err.message);
  }
  try {
    const board = await freezePreviousMonthIfNeeded();
    console.log(
      `[notee-go/jobs] board month=${board.monthKey} count=${board.count} newlyFrozen=${board.frozen}`
    );
  } catch (err) {
    console.error('[notee-go/jobs] board freeze failed:', err.message);
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
        console.error('[notee-go/jobs] cron error:', err.message);
      });
    },
    { timezone: 'Asia/Bangkok' }
  );
  console.log('[notee-go/jobs] scheduled 00:15 Asia/Bangkok (TTL + silent idle + month board)');

  setTimeout(() => {
    runDailyMaintenance('startup').catch((err) => {
      console.error('[notee-go/jobs] startup error:', err.message);
    });
  }, 3000);
}

module.exports = {
  runDailyMaintenance,
  startDailyMaintenanceJobs,
};
