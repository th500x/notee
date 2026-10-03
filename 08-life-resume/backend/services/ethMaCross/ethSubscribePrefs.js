/**
 * 账号级 ETH 订阅方案（Plan A / Plan B）。
 */

const { query } = require('../../database/connection');
const { assertAccountAllowed } = require('../webPush/subscriptionService');
const { ETH_NOTIFY_PLAN, normalizeNotifyPlan } = require('../../constants/ethSubscribe');

class EthSubscribePrefsError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'EthSubscribePrefsError';
    this.code = code;
    this.status = status;
  }
}

async function getNotifyPlan(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  const rows = await query(
    'SELECT notify_plan FROM eth_subscribe_prefs WHERE account_id = ? LIMIT 1',
    [id]
  );
  if (!rows.length) return ETH_NOTIFY_PLAN.DEFAULT;
  return normalizeNotifyPlan(rows[0].notify_plan) || ETH_NOTIFY_PLAN.DEFAULT;
}

async function getSubscribePrefs(accountId) {
  const id = assertAccountAllowed(accountId);
  const notifyPlan = await getNotifyPlan(id);
  return { accountId: id, notifyPlan };
}

async function upsertSubscribePrefs(accountId, body) {
  const id = assertAccountAllowed(accountId);
  const plan = normalizeNotifyPlan(body && body.notifyPlan);
  if (!plan) {
    throw new EthSubscribePrefsError('BAD_NOTIFY_PLAN', '请选择 Plan A 或 Plan B');
  }
  await query(
    `INSERT INTO eth_subscribe_prefs (account_id, notify_plan)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE notify_plan = VALUES(notify_plan)`,
    [id, plan]
  );
  return { accountId: id, notifyPlan: plan };
}

module.exports = {
  EthSubscribePrefsError,
  getNotifyPlan,
  getSubscribePrefs,
  upsertSubscribePrefs,
};
