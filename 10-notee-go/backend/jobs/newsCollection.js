/**
 * News Notes: collect RSS at :05 on every UTC+7 even hour; also once shortly after boot.
 * A run inside an already-counted slot only refreshes titles (see newsService).
 */

const cron = require('node-cron');
const { collectNews } = require('../services/newsService');

let running = null;

async function runNewsCollection(reason = 'manual') {
  if (running) {
    console.log(`[notee-go/news] ${reason} skipped (run in progress)`);
    return running;
  }
  running = (async () => {
    try {
      const run = await collectNews();
      console.log(
        `[notee-go/news] ${reason} stored=${run.stored} failed=${run.failed.length} ` +
          `frozen=${run.frozen.join(',') || '-'} purged=${run.purged}`
      );
      for (const line of run.failed) console.warn(`[notee-go/news] feed ${line}`);
    } catch (err) {
      console.error(`[notee-go/news] ${reason} failed:`, err.message);
    } finally {
      running = null;
    }
  })();
  return running;
}

function startNewsCollectionJobs() {
  cron.schedule(
    '5 */2 * * *',
    () => {
      runNewsCollection('cron');
    },
    { timezone: 'Asia/Bangkok' }
  );
  console.log('[notee-go/jobs] scheduled news every 2h at :05 Asia/Bangkok');

  setTimeout(() => {
    runNewsCollection('startup');
  }, 5000);
}

module.exports = {
  runNewsCollection,
  startNewsCollectionJobs,
};
