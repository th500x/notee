/**
 * 道路遭遇敌对判定（与 `backend/utils/roadDiplomacy.js` 语义一致，供前后端共用）。
 * M2：不同 `faction_id` 即敌对。
 */

export function normalizeFactionId(value) {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * @param {string|null|undefined} aFactionId
 * @param {string|null|undefined} bFactionId
 * @returns {boolean}
 */
export function isHostileByFaction(aFactionId, bFactionId) {
  const a = normalizeFactionId(aFactionId);
  const b = normalizeFactionId(bFactionId);
  if (!a || !b) return false;
  return a !== b;
}
