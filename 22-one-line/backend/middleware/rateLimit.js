/**
 * Route-level limiters (same shape as 11-life-resume).
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

function ipKey(req) {
  return `ip:${ipKeyGenerator(req.ip)}`;
}

const limitedMessage = {
  success: false,
  error: '请求过于频繁，请稍后再试',
  code: 'RATE_LIMITED',
};

const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: limitedMessage,
});

/** Anonymous open / profile write — tighter than public read. */
const authWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: limitedMessage,
});

module.exports = {
  publicReadLimiter,
  authWriteLimiter,
};
