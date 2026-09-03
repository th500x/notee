/**
 * 官员谏言 · 上供银两几率补偿（12-1 §9.4 · 与 passiveApproval 叠加）
 *
 * - 基数 100 银；100 / 200 / 300 …
 * - 每 100 银：审批通过率 +10%（与掷骰后 chance 相加，上限 100%）
 * - 每 100 银：提议官员贡献 +5
 * - 上供银两自玩家 personal silver 扣，划入势力 pool + ledger `remonstrance_tribute`
 */

const TRIBUTE_SILVER_STEP = 100;
const TRIBUTE_APPROVAL_BONUS_PER_STEP = 0.1;
const TRIBUTE_CONTRIBUTION_PER_STEP = 5;

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * @param {unknown} raw
 * @returns {number|null} 规范化后的非负整数；非法（非 100 倍数）→ null
 */
function normalizeTributeSilver(raw) {
  const n = Math.floor(Number(raw) || 0);
  if (n <= 0) return 0;
  if (n % TRIBUTE_SILVER_STEP !== 0) return null;
  return n;
}

/** @param {number} tributeSilver */
function tributeApprovalBonus(tributeSilver) {
  const steps = Math.floor(Math.max(0, Number(tributeSilver) || 0) / TRIBUTE_SILVER_STEP);
  return steps * TRIBUTE_APPROVAL_BONUS_PER_STEP;
}

/** @param {number} tributeSilver */
function tributeContributionGrant(tributeSilver) {
  const steps = Math.floor(Math.max(0, Number(tributeSilver) || 0) / TRIBUTE_SILVER_STEP);
  return steps * TRIBUTE_CONTRIBUTION_PER_STEP;
}

/**
 * @param {object} preview - passiveApproval previewApprovalRange 返回值
 * @param {number} tributeSilver
 */
function applyTributeToApprovalPreview(preview, tributeSilver) {
  const amount = normalizeTributeSilver(tributeSilver);
  if (amount == null) {
    return { ...preview, tributeSilverInvalid: true };
  }
  const bonus = tributeApprovalBonus(amount);
  const minR = clamp01(Number(preview?.minRate) + bonus);
  const maxR = clamp01(Number(preview?.maxRate) + bonus);
  return {
    ...preview,
    tributeSilver: amount,
    tributeBonus: bonus,
    tributeContributionGrant: tributeContributionGrant(amount),
    minRate: minR,
    maxRate: maxR,
  };
}

/**
 * 可选档位：0 … maxAffordable（向下取整到 100 倍数），最多 10 档非零。
 * @param {number} maxAffordableSilver
 * @returns {number[]}
 */
function buildTributeSilverOptions(maxAffordableSilver = 0) {
  const cap = Math.max(0, Math.floor(Number(maxAffordableSilver) || 0));
  const maxSteps = Math.min(10, Math.floor(cap / TRIBUTE_SILVER_STEP));
  const opts = [0];
  for (let s = 1; s <= maxSteps; s += 1) {
    opts.push(s * TRIBUTE_SILVER_STEP);
  }
  return opts;
}

module.exports = {
  TRIBUTE_SILVER_STEP,
  TRIBUTE_APPROVAL_BONUS_PER_STEP,
  TRIBUTE_CONTRIBUTION_PER_STEP,
  normalizeTributeSilver,
  tributeApprovalBonus,
  tributeContributionGrant,
  applyTributeToApprovalPreview,
  buildTributeSilverOptions,
  clamp01,
};
