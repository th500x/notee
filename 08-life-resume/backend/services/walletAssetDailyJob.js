/**
 * 每个 UTC 日历日，给已到起算日的账号自动记一笔。
 * 每两小时一轮，固定在 UTC 偶数整点过 5 分。启动时不立刻跑，等下一轮。
 * 当天已经记下的不再查。连不上就不写 0，下一轮再试。
 */

const { recordDueSnapshots } = require('./walletAssetWatchService');
const { nextRunAt } = require('./walletAssetCalendar');

let timer = null;
let running = false;

async function runWalletAssetDailyPass() {
  if (running) return null;
  running = true;
  try {
    return await recordDueSnapshots();
  } finally {
    running = false;
  }
}

function scheduleNext() {
  const at = nextRunAt();
  timer = setTimeout(() => {
    runWalletAssetDailyPass()
      .catch((err) => {
        console.error('[wallet-assets/daily]', err);
      })
      .finally(scheduleNext);
  }, at.getTime() - Date.now());
  if (typeof timer.unref === 'function') timer.unref();
  console.log('[wallet-assets/daily] next run', at.toISOString());
}

function startWalletAssetDailyJob() {
  if (timer) return;
  scheduleNext();
}

module.exports = {
  startWalletAssetDailyJob,
  runWalletAssetDailyPass,
};
