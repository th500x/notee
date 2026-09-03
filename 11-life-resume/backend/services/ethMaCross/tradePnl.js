/**
 * 操作记录参考收益：方向 ×（出场价 − 买入价）× 数量。
 * 与 07 `src/utils/ethMaTradePnl.js` 同算法；手填 pnl 仍以用户为准。
 */

function crossDirection(cross) {
  if (cross === 'golden') return 1;
  if (cross === 'death') return -1;
  return null;
}

function roundPnl(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function isPresentNumber(value) {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

function suggestTradePnl({ cross, entryPrice, exitPrice, quantity }) {
  const direction = crossDirection(cross);
  if (direction == null) return null;
  if (!isPresentNumber(entryPrice) || !isPresentNumber(exitPrice) || !isPresentNumber(quantity)) {
    return null;
  }
  const entry = Number(entryPrice);
  const exit = Number(exitPrice);
  const qty = Number(quantity);
  return roundPnl(direction * (exit - entry) * qty);
}

module.exports = {
  crossDirection,
  roundPnl,
  suggestTradePnl,
};
