/**
 * JWT auth (HS256) — must use same JWT_SECRET as 05-san-storm.
 */

const jwt = require('jsonwebtoken');

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    const err = new Error('JWT_SECRET 未配置或过短（>=16 字符）');
    err.code = 'JWT_SECRET_MISSING';
    throw err;
  }
  return secret;
}

function isDevBypassOn() {
  return process.env.NODE_ENV !== 'production' && process.env.JWT_DEV_BYPASS === '1';
}

function parseBearer(req) {
  const raw = req.headers && req.headers.authorization;
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function requireAuth(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    return res.status(401).json({ success: false, error: '未登录或会话已失效', code: 'NO_TOKEN' });
  }
  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    if (!payload || !payload.sub) {
      return res.status(401).json({ success: false, error: '令牌缺少 sub 字段', code: 'BAD_TOKEN' });
    }
    req.player = payload;
    return next();
  } catch (err) {
    const code = err && err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'BAD_TOKEN';
    return res.status(401).json({ success: false, error: '会话已失效，请重新登录', code });
  }
}

function optionalAuth(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    req.player = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    req.player = payload && payload.sub ? payload : null;
  } catch {
    req.player = null;
  }
  return next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  getSecret,
  isDevBypassOn,
  DEFAULT_TTL_SECONDS,
};
