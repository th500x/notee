/**
 * 须与 11 sendService 同一套 VAPID + JSON payload + aes128gcm。
 * Cloudflare 上用 Web Crypto，不能 require('web-push')。
 */
import { buildPushFetchInit } from './webPushAes128gcm.js';

const PUSH_TTL_SEC = 15 * 60;
const PUSH_TIMEOUT_MS = 15000;
const GONE_ENDPOINTS_MAX = 50;

function isGoneStatus(status) {
  return status === 404 || status === 410;
}

function isOkStatus(status) {
  return status === 201 || status === 200;
}

export async function sendRelayedPushes(dispatch) {
  const vapid = dispatch && dispatch.vapid;
  const payload = dispatch && dispatch.payload;
  const subscriptions = Array.isArray(dispatch && dispatch.subscriptions)
    ? dispatch.subscriptions
    : [];
  const result = { sent: 0, failed: 0, gone: 0, goneEndpoints: [] };
  if (!vapid || !vapid.publicKey || !vapid.privateKey || !payload) {
    throw new Error('pushDispatch missing vapid or payload');
  }
  const vapidKeys = {
    subject: String(vapid.subject || 'https://notee.vip'),
    publicKey: String(vapid.publicKey),
    privateKey: String(vapid.privateKey),
  };
  const data = JSON.stringify(payload);

  for (const row of subscriptions) {
    const endpoint = String((row && row.endpoint) || '').trim();
    const p256dh = String((row && row.p256dh) || '').trim();
    const auth = String((row && row.auth) || '').trim();
    const accountId = String((row && row.accountId) || '?');
    if (!endpoint || !p256dh || !auth) {
      result.failed += 1;
      console.error(`web-push skip incomplete subscription account=${accountId}`);
      continue;
    }
    try {
      const init = await buildPushFetchInit({
        endpoint,
        p256dh,
        auth,
        body: data,
        vapid: vapidKeys,
        ttlSec: PUSH_TTL_SEC,
        urgency: 'high',
      });
      const res = await fetch(endpoint, {
        method: init.method,
        headers: init.headers,
        body: init.body,
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      });
      if (isOkStatus(res.status)) {
        result.sent += 1;
        continue;
      }
      if (isGoneStatus(res.status)) {
        result.gone += 1;
        if (result.goneEndpoints.length < GONE_ENDPOINTS_MAX) {
          result.goneEndpoints.push(endpoint);
        }
        console.error(`web-push gone HTTP ${res.status} account=${accountId}`);
        continue;
      }
      result.failed += 1;
      console.error(`web-push HTTP ${res.status} account=${accountId}`);
    } catch (err) {
      result.failed += 1;
      const message = err && err.message ? err.message : String(err);
      console.error(`web-push send failed account=${accountId} ${message}`);
    }
  }
  return result;
}

export function ackUrlFromIngest(ingestUrl) {
  const url = String(ingestUrl || '').trim();
  if (url.endsWith('/ingest')) {
    return `${url.slice(0, -'/ingest'.length)}/push-ack`;
  }
  return `${url.replace(/\/$/, '')}/push-ack`;
}

export function summarizeIngestBody(text) {
  try {
    const json = JSON.parse(text);
    const data = json && json.data ? json.data : {};
    const relayCount =
      data.pushDispatch && Array.isArray(data.pushDispatch.subscriptions)
        ? data.pushDispatch.subscriptions.length
        : 0;
    return {
      ok: data.ok,
      reason: data.reason || null,
      cross: data.cross || null,
      relay: relayCount,
    };
  } catch {
    return { parse: false };
  }
}

export function summarizePushResult(push) {
  if (!push) return null;
  return {
    sent: push.sent,
    failed: push.failed,
    gone: push.gone,
  };
}
