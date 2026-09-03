/**
 * 管理员：赛季关服切换（rollover）运营入口（见 19-3 §10 Phase 5 运营）
 *
 *   GET  /api/admin/season-rollover/status?serverId=   只读运营面板（赛季/窗口/维护态/计数）
 *   POST /api/admin/season-rollover/set-window         设结算窗口 + 目标赛季（玩家手动结算按钮出现时间）
 *   POST /api/admin/season-rollover/set-status         设服务器 open/maintenance/closed（维护态拦登录）
 *   POST /api/admin/season-rollover/auto-seal          方式2：自动封档（dryRun 报告 / 实跑）
 *   POST /api/admin/season-rollover/rollover           关服切换（dryRun / 双闸门破坏性实跑）
 *
 * **安全**：当前为单运营，运营口令门禁 **暂时屏蔽**（见 19-3 §16.2）——页面仍受管理员门禁
 *   `AdminPageGate`（主站 `notee-admin-token`）保护，破坏性 rollover 仍叠加服务层
 *   `confirmDestructive` + `backupConfirmed` 双闸门。
 *   后续若有多运营，设 `SEASON_ROLLOVER_KEY`（>=8 字符）并把 `requireSeasonAdminKey` 的早返回去掉即可启用口令校验。
 */
const express = require('express');
const seasonRolloverService = require('../services/seasonRolloverService');
const { wrap500 } = require('../utils/httpError');

const router = express.Router();

/**
 * 运营口令门禁（**当前单运营·暂时屏蔽**，见 19-3 §16.2）。
 *
 * 启用方式：删除下方早返回，并在 `.env` 配置 `SEASON_ROLLOVER_KEY`（>=8 字符）；
 * 启用后未配置该环境变量将 503（fail-closed），口令不符将 403。
 */
function requireSeasonAdminKey(req, res, next) {
  // 暂时屏蔽口令校验：单运营，页面已由 AdminPageGate 保护，破坏性操作另有双闸门。
  return next();

  // eslint-disable-next-line no-unreachable
  const expected = process.env.SEASON_ROLLOVER_KEY;
  if (!expected || String(expected).length < 8) {
    return res.status(503).json({
      success: false,
      code: 'SEASON_ADMIN_KEY_UNCONFIGURED',
      error: '后端未配置 SEASON_ROLLOVER_KEY（>=8 字符），拒绝执行赛季运营操作。',
    });
  }
  const got = req.get('x-season-admin-key') || (req.body && req.body.adminKey);
  if (got !== expected) {
    return res.status(403).json({ success: false, code: 'SEASON_ADMIN_KEY_INVALID', error: '赛季运营口令错误。' });
  }
  next();
}

/** Service 结果 → JSON：保留完整 report / data，便于运营核对每步。 */
function reply(res, out) {
  const ok = out && out.ok !== false;
  return res.status(ok ? 200 : (out.status || 400)).json({ success: ok, ...out });
}

router.get('/status', async (req, res, next) => {
  try {
    const serverId = String(req.query.serverId || '').trim();
    if (!serverId) return res.status(400).json({ success: false, error: '缺少 serverId' });
    return reply(res, await seasonRolloverService.getOpsStatus(serverId));
  } catch (err) {
    return next(wrap500(err, '获取赛季运营状态失败'));
  }
});

router.post('/set-window', requireSeasonAdminKey, async (req, res, next) => {
  try {
    const { serverId, settlementWindowStart, settlementWindowEnd, rolloverTargetSeason } = req.body || {};
    if (!serverId) return res.status(400).json({ success: false, error: '缺少 serverId' });
    const payload = { serverId };
    if ('settlementWindowStart' in (req.body || {})) payload.settlementWindowStart = settlementWindowStart;
    if ('settlementWindowEnd' in (req.body || {})) payload.settlementWindowEnd = settlementWindowEnd;
    if ('rolloverTargetSeason' in (req.body || {})) payload.rolloverTargetSeason = rolloverTargetSeason;
    return reply(res, await seasonRolloverService.setSettlementWindow(payload));
  } catch (err) {
    return next(wrap500(err, '设置结算窗口失败'));
  }
});

router.post('/set-status', requireSeasonAdminKey, async (req, res, next) => {
  try {
    const { serverId, status } = req.body || {};
    if (!serverId) return res.status(400).json({ success: false, error: '缺少 serverId' });
    return reply(res, await seasonRolloverService.setServerStatus({ serverId, status }));
  } catch (err) {
    return next(wrap500(err, '设置服务器状态失败'));
  }
});

router.post('/auto-seal', requireSeasonAdminKey, async (req, res, next) => {
  try {
    const { serverId, dryRun } = req.body || {};
    if (!serverId) return res.status(400).json({ success: false, error: '缺少 serverId' });
    return reply(res, await seasonRolloverService.autoSealAccounts({ serverId, dryRun: dryRun !== false }));
  } catch (err) {
    return next(wrap500(err, '自动封档失败'));
  }
});

router.post('/rollover', requireSeasonAdminKey, async (req, res, next) => {
  try {
    const { serverId, dryRun, runAutoSeal, confirmDestructive, backupConfirmed } = req.body || {};
    if (!serverId) return res.status(400).json({ success: false, error: '缺少 serverId' });
    return reply(res, await seasonRolloverService.executeRollover({
      serverId,
      dryRun: dryRun !== false, // 默认 dryRun，必须显式传 false 才实跑
      runAutoSeal: !!runAutoSeal,
      confirmDestructive: !!confirmDestructive,
      backupConfirmed: !!backupConfirmed,
    }));
  } catch (err) {
    return next(wrap500(err, '赛季切换失败'));
  }
});

module.exports = router;
