/**
 * 部队卡图标 URL（单一主路径 + 单一 UI 文件夹内 fallback，不遍历多后缀/多稀有度文件名）
 * 与 TroopCard、战斗地图共用，避免同一部队连续请求大量不存在的资源。
 */

const RARITY_UI_PREFIX = {
  common: 'r1',
  rare: 'r2',
  epic: 'r3',
  legendary: 'r4',
  core: 'r4',
};

/**
 * weaponType → 与卡面资源命名一致的 icon 名（如 cavalry_lance）
 */
export function normalizeTroopWeaponIconName(troop) {
  const weaponType = troop.weaponType || '';
  if (weaponType.includes('_')) return weaponType;
  if (weaponType) return `${troop.troopType || 'infantry'}_${weaponType}`;
  return 'infantry_saber';
}

/** san_1_ui_card/troop/troop_r{1-4}_{weapon}.png */
export function getTroopUiFolderFallbackUrl(troop, baseUrl = '') {
  const prefix = RARITY_UI_PREFIX[troop.rarity] || 'r1';
  const iconName = normalizeTroopWeaponIconName(troop);
  return `${baseUrl}assets/san_1_ui_card/troop/troop_${prefix}_${iconName}.png`;
}

/** san_1_ui_card/troop/{troopId}.png */
export function getTroopIdIconUrl(troopId, baseUrl = '') {
  if (!troopId) return '';
  return `${baseUrl}assets/san_1_ui_card/troop/${troopId}.png`;
}

/**
 * 主选 URL：自定义 iconPath > 按部队 ID 的 png > 与 fallback 相同的稀有度+武器图
 */
export function getTroopCardPrimaryUrl(troop, baseUrl = '') {
  if (troop.iconPath) return troop.iconPath;
  if (troop.id) return getTroopIdIconUrl(troop.id, baseUrl);
  return getTroopUiFolderFallbackUrl(troop, baseUrl);
}
