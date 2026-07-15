/**
 * 称号/成就 special_effect 标记语言解析（子集）
 * @see docs/00/00-base/04-2-DATA_TERM_DICTIONARY.md §7
 */

/**
 * @param {string|null|undefined} effectStr
 * @returns {number}
 */
function parseDailySilverBonus(effectStr) {
  if (!effectStr || typeof effectStr !== 'string') return 0;
  let total = 0;
  for (const part of effectStr.split(';')) {
    const [key, val] = part.trim().split(':');
    if (key !== 'daily_silver_bonus') continue;
    const n = Number(val);
    if (Number.isFinite(n) && n > 0) total += Math.trunc(n);
  }
  return total;
}

module.exports = {
  parseDailySilverBonus,
};
