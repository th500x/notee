/**
 * 每个曼谷日历日，给已到起算日的账号自动记一笔。
 * 当天已经记下的不再查。连不上就不写 0，下一小时再试。
 */

const { recordDueSnapshots } = require('./walletAssetWatchService');

const INTERVAL_MS = 60 * 60 * 1000;
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

function startWalletAssetDailyJob() {
  if (timer) return;
  const tick = () => {
    runWalletAssetDailyPass().catch((err) => {
      console.error('[wallet-assets/daily]', err);
    });
  };
  timer = setInterval(tick, INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  tick();
}

module.exports = {
  startWalletAssetDailyJob,
  runWalletAssetDailyPass,
};
