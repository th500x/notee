/**
 * 配置表 special_effect 列 → 标记语言原文字符串
 * 须与 configSpecialEffectRaw.js 同步
 */

function unwrapConfigSpecialEffectRaw(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') {
    if (value.raw != null) return String(value.raw);
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.raw != null) return String(parsed.raw);
    } catch {
      /* plain string */
    }
    return trimmed;
  }
  return String(value);
}

module.exports = { unwrapConfigSpecialEffectRaw };
