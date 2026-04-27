/**
 * 与前端 accountingExpression 一致的算术求值（IN/OUT → SETTLE）。
 */

const SAFE_ARITHMETIC = /^[0-9+\-*/().\s]+$/;

function evaluateArithmeticExpression(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return NaN;
  const core = s.startsWith('=') ? s.slice(1).trim() : s;
  if (!core) return NaN;
  if (!SAFE_ARITHMETIC.test(core)) return NaN;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${core})`);
    const v = fn();
    return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

module.exports = { evaluateArithmeticExpression };
