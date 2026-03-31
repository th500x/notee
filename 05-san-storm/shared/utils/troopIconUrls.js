/**
 * 部队卡图标 URL（与仓库内 public/assets/san_1_ui_card/troop 一致）
 *
 * 仅两步，不串联多余路径：
 *  1) core：请求 assets/san_1_ui_card/troop/{配置ID}.png（与文件名完全一致）。
 *     非 core 稀有度不请求配置 ID 图，也不使用 iconPath，统一走稀有度通用图。
 *  2) 失败则用同目录稀有度图：troop/troop_r{1-4}_{兵种}_{武器}.png
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

/**
 * 战斗/卡牌用的部队配置 ID（去掉地图实例后缀 _p0/_e1，纯数字补全 san_1_troop_ 前缀）
 */
export function normalizeTroopAssetId(troopOrId) {
  let raw =
    troopOrId && typeof troopOrId === 'object'
      ? troopOrId.assetTroopId ?? troopOrId.troopId ?? troopOrId.id
      : troopOrId;
  if (raw == null || raw === '') return '';
  let s = String(raw).replace(/_(?:p|e)\d+$/i, '');
  if (s.includes('san_1_troop_')) return s;
  if (/^\d+$/.test(s)) return `san_1_troop_${s}`;
  return s;
}

/** san_1_ui_card/troop/{troopId}.png — 与目录内 san_1_troop_*.png 命名一致 */
export function getTroopIdIconUrl(troopId, baseUrl = '') {
  const id = normalizeTroopAssetId(troopId);
  if (!id) return '';
  return `${baseUrl}assets/san_1_ui_card/troop/${id}.png`;
}

/**
 * 最多 2 个 URL：① core 专属图 ② 稀有度通用图
 * 专属 id 路径（san_1_troop_*.png）仅 core 核心部队尝试；
 * 其余稀有度始终只走 troop_r* 通用规则（不再尝试 iconPath）。
 */
export function getTroopPortraitUrlAttempts(troop, baseUrl = '') {
  const rarityUrl = getTroopUiFolderFallbackUrl(troop, baseUrl);
  const isCore = troop.rarity === 'core';

  if (isCore) {
    const id = normalizeTroopAssetId(troop);
    if (id) {
      const idUrl = `${baseUrl}assets/san_1_ui_card/troop/${id}.png`;
      if (idUrl === rarityUrl) return [rarityUrl];
      return [idUrl, rarityUrl];
    }
  }

  return [rarityUrl];
}

export function getTroopCardPrimaryUrl(troop, baseUrl = '') {
  const list = getTroopPortraitUrlAttempts(troop, baseUrl);
  return list[0] || '';
}
