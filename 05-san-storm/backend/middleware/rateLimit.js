/**
 * 限流中间件（基于 express-rate-limit；内存版，单进程）
 *
 * @description
 *   仅对 **最容易被刷的入口** 启用：
 *     - `loginLimiter`：登录 / 注册（per IP，10 分钟内 20 次）
 *     - `registerCandidatesLimiter`：注册候选 ID 抽取（per IP，1 分钟内 30 次）
 *     - `roadMoveLimiter`：道路沿路移动（per token-sub 或 IP，1 秒最多 5 次；防双 Tab 并发刷）
 *     - `defaultPlayerLimiter`：玩家自助接口的兜底限流（per token-sub，每秒 30 次）
 *
 *   **进程内存存储** = 单实例可用；多实例 / PM2 cluster 时不共享计数（M3 阶段引入 Redis 后切换）。
 *
 * 与 `CODE_REVIEW_2026_04_29.md` 必改 #8 一致：先把"最易被刷"的几个端点接上，其余靠 Nginx
 * / WAF 与后续 Redis store 演进。
 *
 * @module middleware/rateLimit
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

/**
 * IPv6 安全 IP key（v8 起 keyGenerator 必须用 ipKeyGenerator 处理 req.ip，
 * 否则同一 IPv6 /64 网段会按完整 128 位地址各算一条而被绕过）。
 */
function ipKey(req) {
  return `ip:${ipKeyGenerator(req.ip)}`;
}

/** 优先按 token sub 计数；无 token 时回退 IP（仅限合法绕过路径，例如登录） */
function keyByPlayerOrIp(req) {
  if (req.player && req.player.sub) return `sub:${req.player.sub}`;
  return ipKey(req);
}

/** 登录 / 注册（per IP，10 分钟 20 次） */
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { success: false, error: '注册或登录尝试过于频繁，请稍后再试', code: 'RATE_LIMITED' },
});

/** 注册候选 ID 抽取（per IP，1 分钟 30 次） */
const registerCandidatesLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { success: false, error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
});

/** 道路沿路移动（per sub-or-ip，1 秒 5 次） */
const roadMoveLimiter = rateLimit({
  windowMs: 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyByPlayerOrIp,
  message: { success: false, error: '操作过于频繁，请稍候再试', code: 'RATE_LIMITED' },
});

/** 玩家自助接口兜底（per sub-or-ip，1 秒 30 次） */
const defaultPlayerLimiter = rateLimit({
  windowMs: 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyByPlayerOrIp,
  message: { success: false, error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
});

module.exports = {
  loginLimiter,
  registerCandidatesLimiter,
  roadMoveLimiter,
  defaultPlayerLimiter,
};
