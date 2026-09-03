const crypto = require('crypto');
const { query } = require('../../database/connection');
const { ETH_MA_CROSS } = require('../../constants/ethMaCross');
const { validateAccountIdFormat } = require('../../../../33-san-storm/shared/utils/lifeResumeUsername.cjs');

const ENDPOINT_MAX = 1024;
const KEY_MAX = 255;
const UA_MAX = 512;
const ALLOWED_TOPICS = new Set([ETH_MA_CROSS.TOPIC]);

class PushSubscriptionError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'PushSubscriptionError';
    this.code = code;
    this.status = status;
  }
}

function hashEndpoint(endpoint) {
  return crypto.createHash('sha256').update(String(endpoint)).digest('hex');
}

function parseAccountWhitelist(raw = process.env.ETH_MA_PUSH_ACCOUNT_WHITELIST) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const ids = text
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((id) => validateAccountIdFormat(id));
  return ids.length ? new Set(ids) : null;
}

function assertAccountAllowed(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new PushSubscriptionError('BAD_ACCOUNT', '账号格式无效', 400);
  }
  const whitelist = parseAccountWhitelist();
  if (whitelist && !whitelist.has(id)) {
    throw new PushSubscriptionError('NOT_WHITELISTED', '当前账号未开放该通知', 403);
  }
  return id;
}

function normalizeTopic(topic) {
  const value = String(topic || ETH_MA_CROSS.TOPIC).trim();
  if (!ALLOWED_TOPICS.has(value)) {
    throw new PushSubscriptionError('BAD_TOPIC', '不支持的订阅主题', 400);
  }
  return value;
}

function normalizeSubscriptionInput(body) {
  const endpoint = String(body && body.endpoint ? body.endpoint : '').trim();
  const keys = (body && body.keys) || {};
  const p256dh = String(keys.p256dh || '').trim();
  const auth = String(keys.auth || '').trim();
  const userAgent = String(body && body.userAgent ? body.userAgent : '').trim().slice(0, UA_MAX);
  if (!endpoint || endpoint.length > ENDPOINT_MAX || !/^https:\/\//i.test(endpoint)) {
    throw new PushSubscriptionError('BAD_ENDPOINT', '推送 endpoint 无效', 400);
  }
  if (!p256dh || p256dh.length > KEY_MAX || !auth || auth.length > KEY_MAX) {
    throw new PushSubscriptionError('BAD_KEYS', '推送密钥无效', 400);
  }
  return {
    endpoint,
    endpointHash: hashEndpoint(endpoint),
    p256dh,
    auth,
    userAgent: userAgent || null,
    topic: normalizeTopic(body && body.topic),
  };
}

async function upsertSubscription(accountId, body) {
  const id = assertAccountAllowed(accountId);
  const sub = normalizeSubscriptionInput(body);
  await query(
    `INSERT INTO web_push_subscriptions
       (account_id, endpoint, endpoint_hash, p256dh, auth, user_agent, topic)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       account_id = VALUES(account_id),
       endpoint = VALUES(endpoint),
       p256dh = VALUES(p256dh),
       auth = VALUES(auth),
       user_agent = VALUES(user_agent),
       topic = VALUES(topic)`,
    [id, sub.endpoint, sub.endpointHash, sub.p256dh, sub.auth, sub.userAgent, sub.topic]
  );
  return { accountId: id, topic: sub.topic, subscribed: true };
}

async function removeSubscription(accountId, body) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new PushSubscriptionError('BAD_ACCOUNT', '账号格式无效', 400);
  }
  const endpoint = String(body && body.endpoint ? body.endpoint : '').trim();
  if (!endpoint) {
    throw new PushSubscriptionError('BAD_ENDPOINT', '推送 endpoint 无效', 400);
  }
  const topic = normalizeTopic(body && body.topic);
  const result = await query(
    `DELETE FROM web_push_subscriptions
     WHERE account_id = ? AND endpoint_hash = ? AND topic = ?`,
    [id, hashEndpoint(endpoint), topic]
  );
  return { accountId: id, topic, removed: result.affectedRows > 0 };
}

async function getStatus(accountId, topicRaw) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new PushSubscriptionError('BAD_ACCOUNT', '账号格式无效', 400);
  }
  const topic = normalizeTopic(topicRaw);
  const rows = await query(
    `SELECT COUNT(*) AS cnt FROM web_push_subscriptions WHERE account_id = ? AND topic = ?`,
    [id, topic]
  );
  return {
    accountId: id,
    topic,
    subscribed: Number(rows[0] && rows[0].cnt) > 0,
  };
}

async function listSubscriptionsForTopic(topicRaw) {
  const topic = normalizeTopic(topicRaw);
  const whitelist = parseAccountWhitelist();
  const rows = await query(
    `SELECT account_id, endpoint, p256dh, auth, topic
     FROM web_push_subscriptions
     WHERE topic = ?`,
    [topic]
  );
  return rows.filter((row) => {
    const id = String(row.account_id || '').toUpperCase();
    return !whitelist || whitelist.has(id);
  });
}

async function deleteByEndpoint(endpoint) {
  if (!endpoint) return 0;
  const result = await query(
    'DELETE FROM web_push_subscriptions WHERE endpoint_hash = ?',
    [hashEndpoint(endpoint)]
  );
  return result.affectedRows || 0;
}

module.exports = {
  PushSubscriptionError,
  hashEndpoint,
  parseAccountWhitelist,
  assertAccountAllowed,
  normalizeTopic,
  upsertSubscription,
  removeSubscription,
  getStatus,
  listSubscriptionsForTopic,
  deleteByEndpoint,
};
