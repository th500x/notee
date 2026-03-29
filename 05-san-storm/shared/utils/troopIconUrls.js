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
  const id = normalizeTroopAssetId(troopId);
  return `${baseUrl}assets/san_1_ui_card/troop/${id}.png`;
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

/**
 * 按序尝试的立绘 URL（线上常见：troop/id.png、troops/id_card.png、根目录 id_raw.png，最后稀有度+武器）
 */
export function getTroopPortraitUrlAttempts(troop, baseUrl = '') {
  const urls = [];
  const push = (u) => {
    if (u && !urls.includes(u)) urls.push(u);
  };
  if (troop.iconPath) push(troop.iconPath);
  const id = normalizeTroopAssetId(troop);
  if (id) {
    push(`${baseUrl}assets/san_1_ui_card/troop/${id}.png`);
    push(`${baseUrl}assets/san_1_ui_card/troops/${id}_card.png`);
    push(`${baseUrl}assets/san_1_ui_card/${id}_raw.png`);
  }
  push(getTroopUiFolderFallbackUrl(troop, baseUrl));
  return urls;
}

/**
 * 主选 URL：getTroopPortraitUrlAttempts 的第一张（与 TroopCard / 战斗首帧一致）
 */
export function getTroopCardPrimaryUrl(troop, baseUrl = '') {
  const list = getTroopPortraitUrlAttempts(troop, baseUrl);
  return list[0] || '';
}
