/**
 * Route-level limiters (same shape as 11-life-resume). In-process store: single instance only.
 */

const rateLimit = require('express-rate-limit');
const { normalizeLoginId } = require('../lib/loginId');

const { ipKeyGenerator } = rateLimit;

/** IPv6-safe: without ipKeyGenerator every address in a /64 counts separately. */
function ipKey(req) {
  return `ip:${ipKeyGenerator(req.ip)}`;
}

/** Per login id, so one account cannot be brute-forced from rotating addresses. */
function loginIdKey(req) {
  return `login:${normalizeLoginId(req.body && req.body.loginId)}`;
}

const limitedMessage = {
  success: false,
  error: '请求过于频繁，请稍后再试',
  code: 'RATE_LIMITED',
};

const credentialMessage = {
  success: false,
  error: '注册或登录尝试过于频繁，请稍后再试',
  code: 'RATE_LIMITED',
};

function limiter({ windowMs, limit, keyGenerator = ipKey, message = limitedMessage }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    message,
  });
}

const publicReadLimiter = limiter({ windowMs: 60 * 1000, limit: 60 });

/** Anonymous open / profile write — tighter than public read. */
const authWriteLimiter = limiter({ windowMs: 60 * 1000, limit: 20 });

/**
 * Gift claim is one POST per campaign. A Region country pack is 12 campaigns,
 * each followed by a stamp-bag PUT; they must not share the 20/min post limiter.
 */
const giftClaimLimiter = limiter({ windowMs: 60 * 1000, limit: 60 });

/** Bag sync after each local mutation (gift / check-in / craft). */
const stampBagWriteLimiter = limiter({ windowMs: 60 * 1000, limit: 60 });

/** Square-crop PUT/GET: up to 30 sittings × 2 slots after login. */
const pourMediaLimiter = limiter({ windowMs: 60 * 1000, limit: 180 });

/** Login id candidates: cheap, but a refresh button invites tapping. */
const loginIdCandidateLimiter = limiter({ windowMs: 60 * 1000, limit: 30 });

/** Register / login per address. */
const credentialLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: credentialMessage,
});

/** Login attempts per login id, on top of the per-address limit. */
const loginIdAttemptLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  keyGenerator: loginIdKey,
  message: credentialMessage,
});

module.exports = {
  publicReadLimiter,
  authWriteLimiter,
  giftClaimLimiter,
  stampBagWriteLimiter,
  pourMediaLimiter,
  loginIdCandidateLimiter,
  credentialLimiter,
  loginIdAttemptLimiter,
};
