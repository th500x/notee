/**
 * City Events: read the official pages once a day at 00:10 Asia/Bangkok, between the
 * news run (00:05) and daily maintenance (00:15); also once shortly after boot.
 */

const cron = require('node-cron');
const { collectCityEvents } = require('../services/cityEventService');

let running = null;

async function runCityEventCollection(reason = 'manual') {
  if (running) {
    console.log(`[notee-go/city-events] ${reason} skipped (run in progress)`);
    return running;
  }
  running = (async () => {
    try {
      const run = await collectCityEvents();
      console.log(`[notee-go/city-events] ${reason} purged=${run.purged}`);
      for (const p of run.publishers) {
        if (p.error) {
          console.warn(`[notee-go/city-events] ${p.id} failed: ${p.error}`);
          continue;
        }
        console.log(
          `[notee-go/city-events] ${p.id} pages=${p.pages} found=${p.found} kept=${p.kept} ` +
            `added=${p.added} removed=${p.removed} unread=${p.unread} failed=${p.failed.length}`
        );
        if (p.unread > 0 && p.found === 0) {
          console.warn(`[notee-go/city-events] ${p.id} read no events — page layout may have changed`);
        }
        for (const line of p.failed) console.warn(`[notee-go/city-events] ${p.id} page ${line}`);
      }
    } catch (err) {
      console.error(`[notee-go/city-events] ${reason} failed:`, err.message);
    } finally {
      running = null;
    }
  })();
  return running;
}

function startCityEventCollectionJobs() {
  cron.schedule(
    '10 0 * * *',
    () => {
      runCityEventCollection('cron');
    },
    { timezone: 'Asia/Bangkok' }
  );
  console.log('[notee-go/jobs] scheduled city events daily at 00:10 Asia/Bangkok');

  setTimeout(() => {
    runCityEventCollection('startup');
  }, 30000);
}

module.exports = {
  runCityEventCollection,
  startCityEventCollectionJobs,
};
