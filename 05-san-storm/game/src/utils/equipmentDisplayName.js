/**
 * 配置里的装备名可能带「（…长说明）」；结算列表只保留括号前的简短名称。
 * @param {unknown} raw
 * @returns {string}
 */
export function shortEquipmentDisplayName(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw);
  const fw = s.indexOf('（');
  if (fw !== -1) return s.slice(0, fw).trim();
  const hw = s.indexOf('(');
  if (hw !== -1) return s.slice(0, hw).trim();
  return s.trim();
}
