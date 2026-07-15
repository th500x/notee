/**
 * 从 config_troops.troop_id 推断势力展示名（编组 / 初始部队等共用）
 */
function getFactionFromTroopId(troopId) {
  const parts = troopId.split('_');
  if (parts.length >= 4) {
    const factionCode = parts[3].charAt(0);
    const factionMap = {
      '0': '通用',
      '1': '刘备',
      '2': '曹操',
      '3': '孙坚',
      '4': '袁绍',
      '5': '董卓',
      '6': '汉室',
      '7': '黄巾',
    };
    return factionMap[factionCode] || '通用';
  }
  return '通用';
}

module.exports = { getFactionFromTroopId };
