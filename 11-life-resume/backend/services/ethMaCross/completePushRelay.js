/**
 * Cloudflare 海外发完 Web Push 后的回执：清失效 endpoint，成功才 markNotified。
 */

const { markNotified } = require('./signalStateStore');
const { deleteByEndpoint } = require('../webPush/subscriptionService');

function shouldMarkNotified(sent, failed, gone) {
  const sentN = Number(sent) || 0;
  const failedN = Number(failed) || 0;
  const goneN = Number(gone) || 0;
  return sentN > 0 || (goneN > 0 && failedN === 0);
}

function normalizeGoneEndpoints(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, 50)) {
    const endpoint = String(item || '').trim();
    if (!endpoint || endpoint.length > 1024 || !/^https:\/\//i.test(endpoint)) continue;
    out.push(endpoint);
  }
  return out;
}

async function completePushRelay(body) {
  const closedOpenTime = Number(body && body.closedOpenTime);
  if (!Number.isFinite(closedOpenTime) || closedOpenTime <= 0) {
    const err = new Error('closedOpenTime invalid');
    err.code = 'BAD_PUSH_ACK';
    err.status = 400;
    throw err;
  }
  const sent = Number(body && body.sent) || 0;
  const failed = Number(body && body.failed) || 0;
  const gone = Number(body && body.gone) || 0;
  const goneEndpoints = normalizeGoneEndpoints(body && body.goneEndpoints);
  for (const endpoint of goneEndpoints) {
    await deleteByEndpoint(endpoint);
  }
  const marked = shouldMarkNotified(sent, failed, gone);
  if (marked) {
    await markNotified(closedOpenTime);
  }
  return { marked, sent, failed, gone, goneDeleted: goneEndpoints.length };
}

module.exports = {
  shouldMarkNotified,
  normalizeGoneEndpoints,
  completePushRelay,
};
