/**
 * 每个账号保存一个钱包地址，并列出已记下的月均。
 * 日记录由服务器定时写入，不依赖用户当天打开页面。
 */

const { query } = require('../database/connection');
const { calendarDay, firstOfNextMonth, summarizeDailyRows } = require('./walletAssetCalendar');
const { WalletAssetsError, loadWalletAssets, normalizeWalletAddress } = require('./walletAssetsService');

function toDayString(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

async function getWatch(accountId) {
  const rows = await query(
    `SELECT address, DATE_FORMAT(tracking_starts_on, '%Y-%m-%d') AS tracking_starts_on
     FROM wallet_asset_watches
     WHERE account_id = ?
     LIMIT 1`,
    [accountId]
  );
  if (!rows.length) return null;
  return {
    address: rows[0].address,
    trackingStartsOn: toDayString(rows[0].tracking_starts_on),
  };
}

async function listMonths(accountId, address, trackingStartsOn) {
  const rows = await query(
    `SELECT DATE_FORMAT(snapshot_date, '%Y-%m-%d') AS snapshot_date, total_usd
     FROM wallet_asset_daily
     WHERE account_id = ? AND address = ? AND snapshot_date >= ?
     ORDER BY snapshot_date ASC`,
    [accountId, address, trackingStartsOn]
  );
  return summarizeDailyRows(rows.map((row) => ({
    snapshotDate: toDayString(row.snapshot_date),
    totalUsd: row.total_usd,
  })));
}

async function tryQuote(address) {
  try {
    const quote = await loadWalletAssets(address);
    return { quote, quoteError: null };
  } catch (err) {
    if (err instanceof WalletAssetsError) {
      return { quote: null, quoteError: err.message };
    }
    console.error('[life-resume/wallet-assets] quote', err);
    return { quote: null, quoteError: '行情服务暂时连不上' };
  }
}

async function readWatchView(accountId) {
  const watch = await getWatch(accountId);
  if (!watch) {
    return {
      address: null,
      trackingStartsOn: null,
      quote: null,
      quoteError: null,
      months: [],
    };
  }
  const [months, quoted] = await Promise.all([
    listMonths(accountId, watch.address, watch.trackingStartsOn),
    tryQuote(watch.address),
  ]);
  return {
    address: watch.address,
    trackingStartsOn: watch.trackingStartsOn,
    months,
    quote: quoted.quote,
    quoteError: quoted.quoteError,
  };
}

async function saveWatch(accountId, rawAddress) {
  const address = normalizeWalletAddress(rawAddress);
  const startsOn = firstOfNextMonth(calendarDay());
  await query(
    `INSERT INTO wallet_asset_watches (account_id, address, tracking_starts_on)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       tracking_starts_on = IF(address = VALUES(address), tracking_starts_on, VALUES(tracking_starts_on)),
       address = VALUES(address)`,
    [accountId, address, startsOn]
  );
  return readWatchView(accountId);
}

async function clearWatch(accountId) {
  await query('DELETE FROM wallet_asset_watches WHERE account_id = ?', [accountId]);
  return {
    address: null,
    trackingStartsOn: null,
    quote: null,
    quoteError: null,
    months: [],
  };
}

async function recordDueSnapshots() {
  const today = calendarDay();
  const watches = await query(
    `SELECT account_id, address, DATE_FORMAT(tracking_starts_on, '%Y-%m-%d') AS tracking_starts_on
     FROM wallet_asset_watches`
  );
  let recorded = 0;
  for (const watch of watches) {
    const startsOn = toDayString(watch.tracking_starts_on);
    if (!startsOn || today < startsOn) continue;
    const existing = await query(
      `SELECT 1 AS ok FROM wallet_asset_daily
       WHERE account_id = ? AND snapshot_date = ?
       LIMIT 1`,
      [watch.account_id, today]
    );
    if (existing.length) continue;
    try {
      const quote = await loadWalletAssets(watch.address);
      await query(
        `INSERT INTO wallet_asset_daily
          (account_id, address, snapshot_date, total_usd, wallet_usd, position_usd, fees_usd, rewards_usd)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           address = VALUES(address),
           total_usd = VALUES(total_usd),
           wallet_usd = VALUES(wallet_usd),
           position_usd = VALUES(position_usd),
           fees_usd = VALUES(fees_usd),
           rewards_usd = VALUES(rewards_usd)`,
        [
          watch.account_id,
          watch.address,
          today,
          quote.totalUsd,
          quote.walletUsd,
          quote.positionUsd,
          quote.feesUsd,
          quote.rewardsUsd,
        ]
      );
      recorded += 1;
    } catch (err) {
      console.error('[wallet-assets/daily]', watch.account_id, today, err.message || err);
    }
  }
  return { today, recorded };
}

module.exports = {
  getWatch,
  readWatchView,
  saveWatch,
  clearWatch,
  recordDueSnapshots,
};
