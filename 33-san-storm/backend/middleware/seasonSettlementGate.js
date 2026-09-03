/**
 * 赛季继承全局写门禁（Phase 1.2 · 见 19-3 §7.3）
 *
 * 当玩家已「封档」(confirmed) 时，禁止其继续进行会改写存档的玩法操作：
 *   - 封档、未 rollover           → 403 SEASON_SEALED
 *   - 已 rollover、confirmed 未 apply → 403 SEASON_SETTLEMENT_APPLY_PENDING
 *
 * 放行（白名单）：
 *   - 只读方法 GET / HEAD / OPTIONS
 *   - season-settlement 自身路由（preview / confirm / status / apply）
 *
 * 设计：极轻只读查询（命中 season_settlements 索引）；正常运营期（无封档行/窗口关）为快速 next()。
 * 失败语义遵循 P0 fail-closed：判定为封档即拦截，不静默放行。
 *
 * @module middleware/seasonSettlementGate
 */

const seasonSettlementService = require('../services/seasonSettlementService');

const READONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isWhitelistedPath(req) {
  const url = `${req.baseUrl || ''}${req.path || ''}`;
  if (url.includes('/season-settlement')) return true;
  // rollover 后新赛季创角向导（待领取继承也须先完成创角）
  if (url.includes('/creation-progress')) return true;
  if (url.includes('/generate-attributes-batch')) return true;
  if (url.includes('/select-option')) return true;
  return false;
}

/**
 * @param {{ paramKey?: string }} [opts]
 */
function seasonSettlementGate(opts = {}) {
  const paramKey = opts.paramKey || 'playerId';
  return async function gate(req, res, next) {
    try {
      if (READONLY_METHODS.has(req.method)) return next();
      if (isWhitelistedPath(req)) return next();

      const accountId = req.params[paramKey];
      if (!accountId) return next();

      const seal = await seasonSettlementService.getSealStatus(accountId);
      if (!seal.sealed) return next();

      const message =
        seal.code === 'SEASON_SETTLEMENT_APPLY_PENDING'
          ? '新赛季已开启，请先领取继承物品后再继续'
          : '本赛季存档已封档，新赛季开启后可继续';
      return res.status(403).json({ success: false, error: message, code: seal.code });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { seasonSettlementGate };
