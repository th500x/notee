/**
 * 官职 · 签到银两加成展示（原俸禄声望/贡献/资源倍数已废弃）。
 * 步/骑/弓战斗%仍在各组件内 ×100 展示，不走本模块。
 */

function roundDisplayNum(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

/**
 * @param {number|string|null|undefined} value
 * @returns {string|null} 如 "+20银"
 */
export function formatPositionSilverBonusLabel(value) {
  const n = Math.floor(Number(value) || 0);
  if (n <= 0) return null;
  return `+${roundDisplayNum(n)}银`;
}

/** @returns {string|null} 如 "银+20" */
export function formatPositionSilverBonusCompact(value) {
  const n = Math.floor(Number(value) || 0);
  if (n <= 0) return null;
  return `银+${roundDisplayNum(n)}`;
}

/** @deprecated 兼容旧调用 */
export function formatStipendReputationLabel() {
  return null;
}
/** @deprecated */
export function formatStipendContributionLabel() {
  return null;
}
/** @deprecated */
export function formatStipendResourceLabel() {
  return null;
}
/** @deprecated */
export function formatStipendReputationCompact() {
  return null;
}
/** @deprecated */
export function formatStipendContributionCompact() {
  return null;
}
/** @deprecated */
export function formatStipendResourceCompact() {
  return null;
}
