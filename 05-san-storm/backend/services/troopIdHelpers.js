/**
 * 从 config_troops.troop_id 推断势力展示名（编组 / 初始部队等共用）
 * S1 可玩：1xxx 三王 · 2xxx 汉室 · 3xxx 黄巾；NPC：91xx 北疆 · 90xx 众生
 */
function getFactionFromTroopId(troopId) {
  const m = String(troopId || '').match(/_troop_(\d{4})/);
  if (!m) return '通用';
  const code = m[1];
  if (code.startsWith('91') || code.startsWith('8')) return '北疆';
  if (code.startsWith('90')) return '众生';
  const factionMap = {
    '0': '通用',
    '1': '三王',
    '2': '汉室',
    '3': '黄巾',
    '4': '袁绍',
    '5': '董卓',
    '6': '汉室',
    '7': '黄巾',
  };
  return factionMap[code.charAt(0)] || '通用';
}

module.exports = { getFactionFromTroopId };
