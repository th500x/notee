/**
 * 已收盘 K 线序列 → SMA 交叉 → 落库 → Web Push。
 * 本机工人本地发推；海外 ingest（relayPush）把任务交回 Cloudflare 代发。
 */

const { ETH_MA_CROSS } = require('../../constants/ethMaCross');
const { evaluateClosedCloses } = require('./smaCross');
const { formatPushPayload } = require('./formatSignal');
const { getStateRow, saveClosedBar, markNotified } = require('./signalStateStore');
const { sendMaCrossToSubscribers } = require('../webPush/sendService');
const { listSubscriptionsForTopic } = require('../webPush/subscriptionService');
const { getVapidConfig, isVapidConfigured } = require('../webPush/vapid');

const LOG = '[eth-ma-cross]';
const MIN_BARS = ETH_MA_CROSS.SMA_SLOW + 1;

function defaultLog(message) {
  console.log(LOG, message);
}

let applyChain = Promise.resolve();

function sortKlines(klines) {
  return (Array.isArray(klines) ? klines : [])
    .filter(
      (item) =>
        item &&
        Number.isFinite(Number(item.openTime)) &&
        Number.isFinite(Number(item.closeTime)) &&
        Number.isFinite(Number(item.close))
    )
    .map((item) => ({
      openTime: Number(item.openTime),
      closeTime: Number(item.closeTime),
      close: Number(item.close),
    }))
    .sort((a, b) => a.openTime - b.openTime);
}

async function applyOnce(klines, options = {}) {
  const freshCloseMs =
    options.freshCloseMs != null ? options.freshCloseMs : ETH_MA_CROSS.FRESH_CLOSE_MS;
  const log = options.log || defaultLog;
  const sorted = sortKlines(klines);
  if (sorted.length < MIN_BARS) {
    return { ok: false, reason: 'INSUFFICIENT_BARS', barCount: sorted.length };
  }

  const latest = sorted[sorted.length - 1];
  const evaluation = evaluateClosedCloses(sorted.map((item) => item.close));
  if (!evaluation.ok) {
    return { ok: false, reason: evaluation.reason || 'EVAL_FAILED', barCount: sorted.length };
  }

  const state = await getStateRow();
  const alreadySaved = Number(state.last_closed_open_time) === latest.openTime;
  let bar;

  if (alreadySaved) {
    bar = {
      closedOpenTime: latest.openTime,
      closedCloseTime: Number(state.last_closed_close_time) || latest.closeTime,
      close: Number(state.last_close),
      sma7: Number(state.last_sma7),
      sma25: Number(state.last_sma25),
      cross: state.last_bar_cross || null,
    };
  } else {
    bar = {
      closedOpenTime: latest.openTime,
      closedCloseTime: latest.closeTime,
      close: evaluation.close,
      sma7: evaluation.sma7,
      sma25: evaluation.sma25,
      cross: evaluation.cross,
    };
    await saveClosedBar(bar);
    log(
      `closed ${new Date(latest.openTime).toISOString()} close=${bar.close} sma7=${bar.sma7.toFixed(4)} sma25=${bar.sma25.toFixed(4)} cross=${bar.cross || 'none'}`
    );
  }

  if (!bar.cross) {
    return { ok: true, bar, notified: false, reason: 'NO_CROSS', barCount: sorted.length };
  }

  const alreadyNotified = Number(state.last_notified_open_time) === latest.openTime;
  if (alreadyNotified) {
    return { ok: true, bar, notified: false, reason: 'ALREADY_NOTIFIED', barCount: sorted.length };
  }

  const ageMs = Date.now() - Number(bar.closedCloseTime);
  if (ageMs > freshCloseMs) {
    log(`skip notify ${bar.cross} open=${latest.openTime} staleAgeMs=${ageMs}`);
    return { ok: true, bar, notified: false, reason: 'STALE', barCount: sorted.length };
  }

  const payload = formatPushPayload({
    symbol: ETH_MA_CROSS.SYMBOL,
    klineInterval: ETH_MA_CROSS.KLINE_INTERVAL,
    cross: bar.cross,
    close: bar.close,
    sma7: bar.sma7,
    sma25: bar.sma25,
    closedOpenTime: bar.closedOpenTime,
    closedCloseTime: bar.closedCloseTime,
  });

  if (options.relayPush) {
    if (!isVapidConfigured()) {
      log(`skip notify ${bar.cross} VAPID missing`);
      return { ok: true, bar, notified: false, reason: 'VAPID_MISSING', barCount: sorted.length };
    }
    const rows = await listSubscriptionsForTopic();
    if (!rows.length) {
      await markNotified(latest.openTime);
      log(`notify ${bar.cross} close=${bar.close} sent=0/0 gone=0 failed=0`);
      return {
        ok: true,
        bar,
        notified: true,
        push: { sent: 0, total: 0, gone: 0, failed: 0 },
        barCount: sorted.length,
      };
    }
    const vapid = getVapidConfig();
    log(`relay push ${bar.cross} close=${bar.close} subscribers=${rows.length}`);
    return {
      ok: true,
      bar,
      notified: false,
      reason: 'PUSH_RELAY',
      pushDispatch: {
        vapid: {
          subject: vapid.subject,
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
        payload,
        subscriptions: rows.map((row) => ({
          endpoint: row.endpoint,
          p256dh: row.p256dh,
          auth: row.auth,
          accountId: row.account_id,
        })),
      },
      barCount: sorted.length,
    };
  }

  const push = await sendMaCrossToSubscribers(payload);
  await markNotified(latest.openTime);
  log(
    `notify ${bar.cross} close=${bar.close} sent=${push.sent}/${push.total} gone=${push.gone} failed=${push.failed}`
  );
  return { ok: true, bar, notified: true, push, barCount: sorted.length };
}

function applyClosedKlineSeries(klines, options) {
  const run = applyChain.then(() => applyOnce(klines, options));
  applyChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

module.exports = {
  MIN_BARS,
  sortKlines,
  applyClosedKlineSeries,
};
