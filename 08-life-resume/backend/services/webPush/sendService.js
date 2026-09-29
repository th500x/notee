const webpush = require('web-push');
const { ETH_MA_CROSS } = require('../../constants/ethMaCross');
const { assertVapidConfigured } = require('./vapid');
const { listSubscriptionsForTopic, deleteByEndpoint } = require('./subscriptionService');

let vapidReady = false;

function ensureWebPush() {
  if (vapidReady) return;
  const vapid = assertVapidConfigured('web-push');
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  vapidReady = true;
}

function isGoneStatus(statusCode) {
  return statusCode === 404 || statusCode === 410;
}

async function sendToSubscription(row, payload) {
  ensureWebPush();
  const subscription = {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 15 * 60,
      urgency: 'high',
    });
    return { ok: true, accountId: row.account_id };
  } catch (err) {
    const statusCode = err && (err.statusCode || err.status);
    if (isGoneStatus(statusCode)) {
      await deleteByEndpoint(row.endpoint);
      return { ok: false, gone: true, accountId: row.account_id };
    }
    console.error('[web-push] send failed', row.account_id, statusCode || err.message);
    return { ok: false, accountId: row.account_id, error: err.message };
  }
}

async function sendMaCrossToSubscribers(payload, topic = ETH_MA_CROSS.TOPIC) {
  const rows = await listSubscriptionsForTopic(topic);
  if (!rows.length) {
    return { sent: 0, gone: 0, failed: 0, total: 0 };
  }
  const results = await Promise.all(rows.map((row) => sendToSubscription(row, payload)));
  return {
    total: rows.length,
    sent: results.filter((r) => r.ok).length,
    gone: results.filter((r) => r.gone).length,
    failed: results.filter((r) => !r.ok && !r.gone).length,
  };
}

module.exports = {
  sendToSubscription,
  sendMaCrossToSubscribers,
};
