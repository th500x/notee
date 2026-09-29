/**
 * 限流中间件（express-rate-limit；单进程内存）
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

/** 推送订阅 / 退订（per IP，1 分钟 20 次） */
const pushSubscribeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { success: false, error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
});

/** 全站管理员口令（per IP，15 分钟 10 次） */
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { success: false, error: '登录尝试过多，请15分钟后再试' },
});

/** 海外 ingest 投递（per IP，10 分钟 60 次） */
const ethMaIngestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { success: false, error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
});

module.exports = {
  publicReadLimiter,
  loginLimiter,
  registerCandidatesLimiter,
  pushSubscribeLimiter,
  ethMaIngestLimiter,
  adminLoginLimiter,
};
