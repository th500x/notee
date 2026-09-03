/**
 * 官员谏言 · 上供银两 — 游戏前端 ESM 入口。
 * 算法须与 `shared/utils/remonstranceTributeSilver.cjs` 一致；改逻辑时请同步两处。
 * （Vite 不宜 `import` 共享 `.cjs` 的命名导出，见 `positionRerollRarity.js` 同模式。）
 */

export const TRIBUTE_SILVER_STEP = 100;
export const TRIBUTE_APPROVAL_BONUS_PER_STEP = 0.1;
export const TRIBUTE_CONTRIBUTION_PER_STEP = 5;

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
export function normalizeTributeSilver(raw) {
  const n = Math.floor(Number(raw) || 0);
  if (n <= 0) return 0;
  if (n % TRIBUTE_SILVER_STEP !== 0) return null;
  return n;
}

/** @param {number} tributeSilver */
export function tributeApprovalBonus(tributeSilver) {
  const steps = Math.floor(Math.max(0, Number(tributeSilver) || 0) / TRIBUTE_SILVER_STEP);
  return steps * TRIBUTE_APPROVAL_BONUS_PER_STEP;
}

/** @param {number} tributeSilver */
export function tributeContributionGrant(tributeSilver) {
  const steps = Math.floor(Math.max(0, Number(tributeSilver) || 0) / TRIBUTE_SILVER_STEP);
  return steps * TRIBUTE_CONTRIBUTION_PER_STEP;
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * @param {object|null|undefined} preview
 * @param {number} tributeSilver
 */
export function applyTributeToApprovalPreview(preview, tributeSilver) {
  if (!preview) return null;
  const amount = normalizeTributeSilver(tributeSilver);
  if (amount == null) {
    return { ...preview, tributeSilverInvalid: true };
  }
  const bonus = tributeApprovalBonus(amount);
  return {
    ...preview,
    tributeSilver: amount,
    tributeBonus: bonus,
    tributeContributionGrant: tributeContributionGrant(amount),
    minRate: clamp01(Number(preview.minRate) + bonus),
    maxRate: clamp01(Number(preview.maxRate) + bonus),
  };
}

/**
 * @param {number} maxAffordableSilver
 * @returns {number[]}
 */
export function buildTributeSilverOptions(maxAffordableSilver = 0) {
  const cap = Math.max(0, Math.floor(Number(maxAffordableSilver) || 0));
  const maxSteps = Math.min(10, Math.floor(cap / TRIBUTE_SILVER_STEP));
  const opts = [0];
  for (let s = 1; s <= maxSteps; s += 1) {
    opts.push(s * TRIBUTE_SILVER_STEP);
  }
  return opts;
}
