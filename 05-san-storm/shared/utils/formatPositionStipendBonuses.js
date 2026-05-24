/**
 * 官职 · 俸禄向加成展示（声望/贡献：每日固定 +N；资源：俸禄银粮 ×倍数）。
 * 步/骑/弓战斗%仍在各组件内 ×100 展示，不走本模块。
 */

function roundDisplayNum(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

function isLegacyPercentStipendValue(n) {
  return n > 0 && n < 1;
}

/**
 * @param {number|string|null|undefined} value
 * @returns {string|null} 如 "+5"
 */
export function formatStipendReputationLabel(value) {
  const n = Number(value) || 0;
  if (n <= 0) return null;
  if (isLegacyPercentStipendValue(n)) return `+${(n * 100).toFixed(0)}%`;
  return `+${roundDisplayNum(n)}`;
}

/**
 * @param {number|string|null|undefined} value
 * @returns {string|null}
 */
export function formatStipendContributionLabel(value) {
  const n = Number(value) || 0;
  if (n <= 0) return null;
  if (isLegacyPercentStipendValue(n)) return `+${(n * 100).toFixed(0)}%`;
  return `+${roundDisplayNum(n)}`;
}

/**
 * @param {number|string|null|undefined} value
 * @returns {string|null} 如 "×1.2" 或旧数据 "+25%"
 */
export function formatStipendResourceLabel(value) {
  const n = Number(value) || 0;
  if (n <= 0) return null;
  if (n >= 1) return `×${roundDisplayNum(n)}`;
  if (isLegacyPercentStipendValue(n)) return `+${(n * 100).toFixed(0)}%`;
  return null;
}

/** @returns {string|null} 如 "声+5" */
export function formatStipendReputationCompact(value) {
  const core = formatStipendReputationLabel(value);
  return core ? `声${core}` : null;
}

/** @returns {string|null} 如 "贡+10" */
export function formatStipendContributionCompact(value) {
  const core = formatStipendContributionLabel(value);
  return core ? `贡${core}` : null;
}

/** @returns {string|null} 如 "资×1.2" */
export function formatStipendResourceCompact(value) {
  const core = formatStipendResourceLabel(value);
  return core ? `资${core}` : null;
}
