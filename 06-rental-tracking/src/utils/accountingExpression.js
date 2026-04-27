/**
 * 账目单单元格：仅允许纯算术（数字与 + - * / () 与空格），可前导 =；不支持引用其他格。
 * 使用白名单 + Function 求值（已剔除字母与其它符号）。
 */

const SAFE_ARITHMETIC = /^[0-9+\-*/().\s]+$/;

/**
 * @param {string} raw
 * @returns {number} 无法求值时返回 NaN
 */
export function evaluateArithmeticExpression(raw) {
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

export function formatAccountingNumber(n) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
