/**
 * 鉴权中间件（HS256 JWT）
 *
 * @description
 *   - `requireAuth`：解析 `Authorization: Bearer <token>`；缺失或验签失败返回 401。
 *   - `requireSelf(paramKey)`：在 `requireAuth` 之后使用；要求 token 中的 `sub`（账号 ID）与
 *     URL 路径中的 `:playerId` 一致，否则 403。**与本人 ID 不一致的越权访问统一拦在中间件层**，
 *     `routes/players.js` 等子路径无需重复散落 `if (req.params.playerId !== ...)` 类校验。
 *   - `requireAdmin`：在 `requireAuth` 之后使用；要求 `role === 'admin'`（玩家 JWT 或主站 global JWT）。
 *   - `requireAdminAccess`：`requireAuth` + `requireAdmin` 组合；支持 `ADMIN_DEV_BYPASS` 本地兜底。
 *   - `signPlayerToken(account)`：登录 / 注册时调用，签发玩家会话 JWT。
 *
 * 与 `02-architecture-split/11-backend-layering.md §2.1.2` 蓝图对齐：
 *   原蓝图列出 `middleware/auth.js`（未落地），本文件正式补齐。
 *
 * 配套规则：
 *   - JWT_SECRET 走环境变量；缺失则 server.js 拒绝启动（不允许"开发期默认 secret"静默兜底）。
 *   - Token 中仅放 `sub`（账号 ID）+ `role`（player / admin）+ `iat / exp`；不放敏感字段。
 *   - 默认有效期 30 天；可由 .env `PLAYER_TOKEN_TTL_SECONDS` 覆盖。
 *
 * @module middleware/auth
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

function getGlobalJwtSecret() {
  const secret = process.env.GLOBAL_JWT_SECRET;
  if (!secret || secret.length < 16) return null;
  return secret;
}

function getTokenTtlSeconds() {
  const raw = parseInt(process.env.PLAYER_TOKEN_TTL_SECONDS, 10);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_SECONDS;
  return raw;
}

/**
 * 签发玩家会话 JWT。
 * @param {{ id: string, role?: string }} account
 * @returns {{ token: string, expiresAt: number }} expiresAt：UNIX 毫秒
 */
function signPlayerToken(account) {
  const ttl = getTokenTtlSeconds();
  const token = jwt.sign(
    { sub: String(account.id), role: account.role || 'player' },
    getSecret(),
    { algorithm: 'HS256', expiresIn: ttl }
  );
  return { token, expiresAt: Date.now() + ttl * 1000 };
}

function parseBearer(req) {
  const raw = req.headers && req.headers.authorization;
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * 仅开发期：当 `NODE_ENV !== 'production'` 且 `JWT_DEV_BYPASS=1` 时启用。
 *
 * 用途：本地老 localStorage 中只有 `gameUser`、没有 JWT（属于鉴权落地之前的会话）时，
 *      让 `requireAuth` 从 URL `:playerId` / query `playerId` / body `playerId` 推断身份，
 *      避免本地验证基础功能时被 401 阻断。
 *
 * 限制：
 *   - 生产环境（`NODE_ENV === 'production'`）下**永远**忽略此 env，避免误开放鉴权；
 *   - 仅签出 `role: 'player'`，不会赋予 admin 权限；
 *   - 路由 `requireSelf` 仍会强校验"playerId 与推断 sub 一致"（推断本身就来自同一来源，自动通过；
 *     若来源缺失，仍按 401 处理，**不绕过 requireSelf 的语义**）。
 */
function isDevBypassOn() {
  return process.env.NODE_ENV !== 'production' && process.env.JWT_DEV_BYPASS === '1';
}

/**
 * 仅开发期：当 `NODE_ENV !== 'production'` 且 `ADMIN_DEV_BYPASS=1` 时启用。
 * 仅用于 `/api/admin/*` 等管理路由；与前端 `adminDevBypass` 切换配合，生产永远忽略。
 */
function isAdminDevBypassOn() {
  return process.env.NODE_ENV !== 'production' && process.env.ADMIN_DEV_BYPASS === '1';
}

function tryVerifyGlobalAdminToken(token) {
  const secret = getGlobalJwtSecret();
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (!payload || payload.type !== 'global' || payload.access !== 'granted') return null;
    return {
      sub: 'global-admin',
      role: 'admin',
      iat: payload.iat,
      exp: payload.exp,
      _globalAdmin: true,
      project: payload.project,
    };
  } catch {
    return null;
  }
}

/**
 * Express 中间件：要求合法 JWT；解析后挂到 `req.player = { sub, role, iat, exp }`。
 * 接受玩家 JWT（`JWT_SECRET`）或主站管理员 JWT（`GLOBAL_JWT_SECRET`，payload.type=global）。
 */
function requireAuth(req, res, next) {
  const token = parseBearer(req);
  if (!token) {
    if (isDevBypassOn()) {
      if (!global.__JWT_DEV_BYPASS_WARNED__) {
        global.__JWT_DEV_BYPASS_WARNED__ = true;
        console.warn('[auth] ⚠️  JWT_DEV_BYPASS=1 已启用 —— 仅供本地开发期老会话兜底，请勿在生产配置该环境变量');
      }
      req.player = { sub: null, role: 'player', _devBypass: true };
      return next();
    }
    return res.status(401).json({ success: false, error: '未登录或会话已失效', code: 'NO_TOKEN' });
  }

  let playerExpired = false;
  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    if (payload && payload.sub) {
      req.player = payload;
      return next();
    }
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') playerExpired = true;
  }

  const adminPayload = tryVerifyGlobalAdminToken(token);
  if (adminPayload) {
    req.player = adminPayload;
    return next();
  }

  const code = playerExpired ? 'TOKEN_EXPIRED' : 'BAD_TOKEN';
  return res.status(401).json({ success: false, error: '会话已失效，请重新登录', code });
}

/**
 * 管理路由专用：`requireAuth` + `requireAdmin`；缺失 token 时可用 `ADMIN_DEV_BYPASS=1` 兜底。
 */
function requireAdminAccess(req, res, next) {
  const token = parseBearer(req);
  if (!token && isAdminDevBypassOn()) {
    if (!global.__ADMIN_DEV_BYPASS_WARNED__) {
      global.__ADMIN_DEV_BYPASS_WARNED__ = true;
      console.warn('[auth] ⚠️  ADMIN_DEV_BYPASS=1 已启用 —— 仅供本地管理页调试，请勿在生产配置该环境变量');
    }
    req.player = { sub: 'dev-admin', role: 'admin', _devBypass: true };
    return next();
  }
  requireAuth(req, res, () => {
    requireAdmin(req, res, next);
  });
}

/**
 * 要求 token 中的 `sub` 与路径参数 `:paramKey` 一致；默认 paramKey='playerId'。
 * 用于所有 `/:playerId/*` 玩家自助接口；admin 角色仍可越权访问（保留管理员能力路径）。
 */
function requireSelf(paramKey = 'playerId') {
  return function (req, res, next) {
    if (!req.player) {
      return res.status(401).json({ success: false, error: '未登录或会话已失效', code: 'NO_TOKEN' });
    }
    const target = req.params[paramKey];
    if (req.player._devBypass && req.player.sub == null) {
      if (!target || String(target).trim() === '') {
        return res.status(401).json({ success: false, error: '未登录或会话已失效', code: 'NO_TOKEN' });
      }
      req.player = { ...req.player, sub: String(target) };
      return next();
    }
    if (!req.player.sub) {
      return res.status(401).json({ success: false, error: '未登录或会话已失效', code: 'NO_TOKEN' });
    }
    if (req.player.role === 'admin') return next();
    if (!target || String(target) !== String(req.player.sub)) {
      return res.status(403).json({ success: false, error: '无权访问他人数据', code: 'FORBIDDEN' });
    }
    next();
  };
}

/**
 * 仅 admin 角色可访问。
 */
function requireAdmin(req, res, next) {
  if (!req.player || !req.player.sub) {
    return res.status(401).json({ success: false, error: '未登录或会话已失效', code: 'NO_TOKEN' });
  }
  if (req.player.role !== 'admin') {
    return res.status(403).json({ success: false, error: '需要管理员权限', code: 'FORBIDDEN' });
  }
  next();
}

module.exports = {
  requireAuth,
  requireSelf,
  requireAdmin,
  requireAdminAccess,
  signPlayerToken,
  getTokenTtlSeconds,
};
