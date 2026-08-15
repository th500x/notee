/**
 * 限流中间件（express-rate-limit；单进程内存，与 05-san-storm 同模式）
 *
 * 公开读接口 per IP 限流，防批量爬取 / 刷库 / OSS 签名滥用。
 * 多实例时需 Redis store（后续演进）；生产建议在 Nginx 再叠 limit_req。
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

function ipKey(req) {
  return `ip:${ipKeyGenerator(req.ip)}`;
}

/** 公开读：时间轴、首页公开卡片（per IP，1 分钟 60 次） */
const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { success: false, error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
});

/** 登录 / 注册（per IP，10 分钟 20 次；与 05 同口径） */
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { success: false, error: '注册或登录尝试过于频繁，请稍后再试', code: 'RATE_LIMITED' },
});

/** 注册候选 ID 抽取（per IP，1 分钟 30 次；与 05 同口径） */
const registerCandidatesLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { success: false, error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
});

module.exports = {
  publicReadLimiter,
  loginLimiter,
  registerCandidatesLimiter,
};
