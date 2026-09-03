/**
 * 势力政策 · 谏言职务白名单（11-3 §7.1）
 *
 * 唯一权威来源：本模块；其它 service / route 调 `assertPolicyProposer(...)`，
 * **禁止** 散写 `if (current_position_id === 'san_1_position_dasima')`（与 san-storm-data-layer
 * 「不在业务里硬编码势力名」一致 —— 这里把官职 id 集中，将来赛季化或扩枚举只改本文件）。
 *
 * - **长效**（粮饷 Bonus / 城战奖赏 / 招贤 / 内政）：**大司马** 或 **大司空**
 * - **临时**（前军 / 后军 / 御驾，**仅 PVP**）：**大将军** 或 **大司空**
 *
 * 君主（`position_level === 0`）不走玩家谏言提案链；其它一品官职即便能进朝政查看，亦不在白名单。
 *
 * @module services/policyProposerAuth
 * @see 11-3-FACTION_POLICY_SYSTEM.md §7.1
 */

const { httpError } = require('../utils/httpError');

/** 政策提议 scope（与 `assertPolicyProposer` 参数对齐） */
const POLICY_SCOPE = Object.freeze({
  LONG_TERM: 'long_term',
  TRANSIENT: 'transient',
});

/**
 * 长效政策白名单（11-3 §7.1）：大司马 + 大司空。
 * 赛季 id 集中在此；将来若 san_2 改前缀，此处 + 文档同步。
 */
const LONG_TERM_PROPOSER_IDS = Object.freeze(
  new Set(['san_1_position_dasima', 'san_1_position_dasikong']),
);

/**
 * 临时政策白名单（11-3 §7.1）：大将军 + 大司空。
 */
const TRANSIENT_PROPOSER_IDS = Object.freeze(
  new Set(['san_1_position_dajiangjun', 'san_1_position_dasikong']),
);

/**
 * 判断某官职 id 是否在指定 scope 的白名单中。
 *
 * @param {string|null|undefined} positionId
 * @param {'long_term'|'transient'} scope
 * @returns {boolean}
 */
function canProposePolicy(positionId, scope) {
  const id = String(positionId || '').trim();
  if (!id) return false;
  if (scope === POLICY_SCOPE.LONG_TERM) return LONG_TERM_PROPOSER_IDS.has(id);
  if (scope === POLICY_SCOPE.TRANSIENT) return TRANSIENT_PROPOSER_IDS.has(id);
  return false;
}

/**
 * 给前端 panel 用：返回 scope 白名单的全量 position_id 列表（便于 UI 显示「所需官职」）。
 *
 * @param {'long_term'|'transient'} scope
 * @returns {string[]}
 */
function getProposerPositionIds(scope) {
  if (scope === POLICY_SCOPE.LONG_TERM) return Array.from(LONG_TERM_PROPOSER_IDS);
  if (scope === POLICY_SCOPE.TRANSIENT) return Array.from(TRANSIENT_PROPOSER_IDS);
  return [];
}

/**
 * 强制断言：当前玩家可对该 scope 提议；不满足直接 403。
 *
 * @param {object} player - `Player.getById(...)` 行
 * @param {'long_term'|'transient'} scope
 * @throws HttpError(403, ...) 不在白名单时
 */
function assertPolicyProposer(player, scope) {
  const currentPositionId = String(player?.current_position_id || '').trim();
  if (!canProposePolicy(currentPositionId, scope)) {
    const need =
      scope === POLICY_SCOPE.LONG_TERM
        ? '大司马 / 大司空'
        : '大将军 / 大司空';
    throw httpError(
      403,
      `该提案仅限「${need}」可谏言；当前官职无权提议。`,
      'POLICY_PROPOSER_FORBIDDEN',
    );
  }
}

module.exports = {
  POLICY_SCOPE,
  LONG_TERM_PROPOSER_IDS,
  TRANSIENT_PROPOSER_IDS,
  canProposePolicy,
  getProposerPositionIds,
  assertPolicyProposer,
};
