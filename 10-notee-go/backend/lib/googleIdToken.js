/**
 * Google ID tokens from the app's Credential Manager sign-in (notee-go docs/00-core/00-1-Account.md §4).
 * Checked against Google's published signing keys, audience = our web client id, issuer = Google.
 * Without GOOGLE_WEB_CLIENT_ID this refuses. It never trusts an unverified token.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { httpError } = require('./httpError');

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const FETCH_TIMEOUT_MS = 10 * 1000;
const DEFAULT_KEYS_TTL_MS = 60 * 60 * 1000;
/** An unknown key id refetches at most this often, so junk tokens cannot hammer Google. */
const REFETCH_GAP_MS = 60 * 1000;
const CLOCK_TOLERANCE_SECONDS = 60;

let cachedKeys = null;
let inflight = null;

function unavailable() {
  return httpError(503, '服务器还不能核对 Google 登录', 'GOOGLE_AUTH_UNAVAILABLE');
}

function rejected() {
  return httpError(401, 'Google 凭证无效，请重新登录 Google', 'BAD_GOOGLE_TOKEN');
}

function webClientId() {
  const id = String(process.env.GOOGLE_WEB_CLIENT_ID || '').trim();
  if (!id) throw unavailable();
  return id;
}

function maxAgeMs(cacheControl) {
  const match = /max-age=(\d+)/i.exec(cacheControl || '');
  return match ? Number(match[1]) * 1000 : DEFAULT_KEYS_TTL_MS;
}

async function fetchKeys() {
  let res;
  try {
    res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    throw unavailable();
  }
  const body = res.ok ? await res.json().catch(() => null) : null;
  if (!body || !Array.isArray(body.keys)) throw unavailable();
  const byKid = new Map();
  for (const jwk of body.keys) {
    if (jwk && jwk.kty === 'RSA' && jwk.kid) {
      byKid.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
    }
  }
  const now = Date.now();
  return { byKid, fetchedAt: now, expiresAt: now + maxAgeMs(res.headers.get('cache-control')) };
}

async function refreshKeys() {
  if (!inflight) {
    inflight = fetchKeys().finally(() => {
      inflight = null;
    });
  }
  cachedKeys = await inflight;
  return cachedKeys;
}

/** Google rotates its keys, so an id we have not seen triggers one refetch. */
async function keyFor(kid) {
  const now = Date.now();
  let keys = cachedKeys;
  if (!keys || keys.expiresAt <= now) {
    keys = await refreshKeys();
  } else if (!keys.byKid.has(kid) && now - keys.fetchedAt >= REFETCH_GAP_MS) {
    keys = await refreshKeys();
  }
  return keys.byKid.get(kid) || null;
}

/**
 * Signature, audience, issuer, expiry. Exported for the offline assert with a local key.
 * @returns {{ sub: string }}
 */
function verifySignedIdToken(idToken, publicKey, audience) {
  let payload;
  try {
    payload = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience,
      issuer: ISSUERS,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
  } catch (err) {
    throw rejected();
  }
  if (!payload || typeof payload.sub !== 'string' || !payload.sub) throw rejected();
  return { sub: payload.sub };
}

/**
 * @param {unknown} raw the `idToken` field of a request body
 * @returns {Promise<{ sub: string }>} Google's stable account id
 */
async function verifyGoogleIdToken(raw) {
  const audience = webClientId();
  const idToken = typeof raw === 'string' ? raw.trim() : '';
  if (!idToken) throw httpError(400, 'Google 凭证不完整', 'BAD_GOOGLE_TOKEN');
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded && decoded.header && decoded.header.kid;
  if (typeof kid !== 'string' || !kid) throw rejected();
  const key = await keyFor(kid);
  if (!key) throw rejected();
  return verifySignedIdToken(idToken, key, audience);
}

module.exports = {
  ISSUERS,
  verifySignedIdToken,
  verifyGoogleIdToken,
};
