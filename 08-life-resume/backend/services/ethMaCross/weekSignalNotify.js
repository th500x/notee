/**
 * 周指标信号：落库后按账号 notifyPlan 过滤并 Web Push。
 */

const { ETH_MA_CROSS } = require('../../constants/ethMaCross');
const { planMatchesWeekSignal } = require('../../constants/ethSubscribe');
const { listSubscriptionsForTopic } = require('../webPush/subscriptionService');
const { sendToSubscription } = require('../webPush/sendService');
const { isVapidConfigured } = require('../webPush/vapid');
const { getNotifyPlan } = require('./ethSubscribePrefs');
const { formatWeekPushPayload } = require('./weekSignalFormat');
const {
  upsertWeekSignal,
  markWeekBroadcastDone,
  getWeekSignalById,
} = require('./weekSignalStore');
const { formatWeekSignalRow } = require('./weekSignalFormat');

async function resolveAccountPlan(accountId, cache) {
  const id = String(accountId || '').toUpperCase();
  if (cache.has(id)) return cache.get(id);
  const plan = await getNotifyPlan(id);
  cache.set(id, plan);
  return plan;
}

async function broadcastWeekSignal(signalRow, options = {}) {
  const force = Boolean(options.force);
  const formatted = formatWeekSignalRow(signalRow);
  if (!formatted) {
    return { notified: false, reason: 'NO_SIGNAL', push: null };
  }
  if (!force && Number(signalRow.broadcast_done) === 1) {
    return { notified: false, reason: 'ALREADY_BROADCAST', signal: formatted, push: null };
  }
  if (!isVapidConfigured()) {
    return { notified: false, reason: 'VAPID_MISSING', signal: formatted, push: null };
  }

  const rows = await listSubscriptionsForTopic(ETH_MA_CROSS.TOPIC);
  if (!rows.length) {
    await markWeekBroadcastDone(formatted.weekId);
    return {
      notified: true,
      reason: 'NO_SUBSCRIBERS',
      signal: formatted,
      push: { sent: 0, total: 0, gone: 0, failed: 0 },
    };
  }

  const planCache = new Map();
  const targets = [];
  for (const row of rows) {
    const plan = await resolveAccountPlan(row.account_id, planCache);
    if (!planMatchesWeekSignal(plan, formatted)) continue;
    targets.push({ row, plan });
  }

  if (!targets.length) {
    await markWeekBroadcastDone(formatted.weekId);
    return {
      notified: true,
      reason: 'NO_MATCHING_PLAN',
      signal: formatted,
      push: { sent: 0, total: 0, gone: 0, failed: 0 },
    };
  }

  const results = await Promise.all(
    targets.map(({ row, plan }) =>
      sendToSubscription(row, formatWeekPushPayload(formatted, plan))
    )
  );
  await markWeekBroadcastDone(formatted.weekId);
  const push = {
    total: targets.length,
    sent: results.filter((r) => r.ok).length,
    gone: results.filter((r) => r.gone).length,
    failed: results.filter((r) => !r.ok && !r.gone).length,
  };
  console.log(
    '[eth-week]',
    `notify ${formatted.weekId} ${formatted.kindLabel} sent=${push.sent}/${push.total}`
  );
  return { notified: true, reason: null, signal: formatted, push };
}

/**
 * @param {object|object[]} body 单周或 { weeks: [] }
 */
async function ingestWeekSignals(body) {
  const list = Array.isArray(body && body.weeks)
    ? body.weeks
    : body && body.weekId
      ? [body]
      : [];
  if (!list.length) {
    const err = new Error('缺少 weeks');
    err.code = 'BAD_WEEK_INGEST';
    err.status = 400;
    throw err;
  }

  const results = [];
  for (const item of list) {
    const upserted = await upsertWeekSignal(item);
    if (!upserted.stored) {
      results.push({
        weekId: upserted.weekId,
        stored: false,
        reason: upserted.reason,
        notified: false,
      });
      continue;
    }
    const row = upserted.row || (await getWeekSignalById(upserted.signal.weekId));
    const broadcast = await broadcastWeekSignal(row, {
      force: Boolean(body && body.forceBroadcast),
    });
    results.push({
      weekId: upserted.signal.weekId,
      stored: true,
      notified: broadcast.notified,
      reason: broadcast.reason,
      push: broadcast.push,
      signal: broadcast.signal || upserted.signal,
    });
  }
  return { ok: true, results };
}

module.exports = {
  broadcastWeekSignal,
  ingestWeekSignals,
};
