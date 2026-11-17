/**
 * Party Pass tiers. One vocabulary for the user row, the API, and the app.
 *
 * none   free
 * 99     Party Pass 99
 * 499    Party Pass 499
 * ultra  Party Pass Ultra, staff-assigned, not a Play product
 *
 * The +50 P-Points are only for buying 499 while a live 99 purchase is already older.
 */

const PRODUCT_99 = 'party_pass_99';
const PRODUCT_499 = 'party_pass_499';
const UPGRADE_MARKS = 50;

const PRODUCTS = {
  [PRODUCT_99]: '99',
  [PRODUCT_499]: '499',
};

function tierCode(raw) {
  const value = raw == null ? '' : String(raw);
  if (value === '99' || value === '499' || value === 'ultra') return value;
  return 'none';
}

function isPass(code) {
  return code === '99' || code === '499' || code === 'ultra';
}

function productIdFor(tier) {
  if (tier === '99') return PRODUCT_99;
  if (tier === '499') return PRODUCT_499;
  return null;
}

function effectiveTier({ ultra, purchases }) {
  if (ultra) return 'ultra';
  const live = (purchases || []).filter((row) => row.state === 'purchased');
  if (live.some((row) => row.productId === PRODUCT_499)) return '499';
  if (live.some((row) => row.productId === PRODUCT_99)) return '99';
  return 'none';
}

function createdMs(row) {
  const value = row.createdAt;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * @returns {{ delta: number, open: boolean }}
 * `open` is whether the +50 is currently on the account.
 */
function upgradeAdjustment({ purchases, upgradeOpen }) {
  const live = (purchases || []).filter((row) => row.state === 'purchased');
  const nineties = live.filter((row) => row.productId === PRODUCT_99);
  const highs = live.filter((row) => row.productId === PRODUCT_499);
  const open = Boolean(upgradeOpen);
  if (nineties.length === 0 || highs.length === 0) {
    return open ? { delta: -UPGRADE_MARKS, open: false } : { delta: 0, open: false };
  }
  const first99 = Math.min(...nineties.map(createdMs));
  const first499 = Math.min(...highs.map(createdMs));
  const earned = first499 >= first99;
  if (earned && !open) return { delta: UPGRADE_MARKS, open: true };
  if (!earned && open) return { delta: -UPGRADE_MARKS, open: false };
  return { delta: 0, open: earned && open };
}

module.exports = {
  PRODUCT_99,
  PRODUCT_499,
  UPGRADE_MARKS,
  PRODUCTS,
  tierCode,
  isPass,
  productIdFor,
  effectiveTier,
  upgradeAdjustment,
};
