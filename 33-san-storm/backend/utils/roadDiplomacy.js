/**
 * 道路遭遇敌对判定（02 §2.1.2（6）、13-1 §1.6.2（7）、31-6 §5）。
 *
 * M2 简化：`players.faction_id` 不同即互相敌对；同势力不算敌对。
 * 未来接入外交权威表时，仅替换此函数实现，API 路径与请求体不变。
 */

function normalizeFactionId(value) {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * @param {string|null|undefined} aFactionId
 * @param {string|null|undefined} bFactionId
 * @returns {boolean} true 表示互相敌对
 */
function isHostileByFaction(aFactionId, bFactionId) {
  const a = normalizeFactionId(aFactionId);
  const b = normalizeFactionId(bFactionId);
  if (!a || !b) return false;
  return a !== b;
}

module.exports = {
  isHostileByFaction,
  normalizeFactionId,
};
