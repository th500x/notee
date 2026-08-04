/**
 * - **卡面 / 编组 / wiki / 战斗静态回退**：`public/assets/san_1_ui_card/troop/` → `getTroopPortraitUrlAttempts`（无阵营子目录）。
 * - **战斗格序列帧**（主路径）：`san_1_battle/units/{unitKey}/`（见 `battleUnitKeyResolve`）；阵营靠光晕，不按势力复制立绘。
 * - **大型图格缩略图**：与卡面同源（阶段 E 已删除 `san_1_battle/{player|enemy|ally*}` 静态立绘目录；保留 `faction/`、`units/`、`effect/`）。
 *
 * 专属 `{配置ID}.png` 优先于 `troop_r{1-4}_{weapon}.png` 当且仅当：稀有度 **core**，或 **北疆 91xx / 众生 90xx**（`_troop_` 后数字段以 9 开头；兼容旧 8xxx）。无同名 PNG 时回退稀有度通用图。
 *
 * 部队元数据（稀有度 / 兵种 / 武器）由应用层注入，避免 shared 硬绑 `public/data` 路径：
 *   `configureTroopIconMetaCatalog(troopsCatalog)` — 见 `game/src/bootstrap/troopIconUrlsCatalog.js`。
 * 专属 `{troop_id}.png` 无落地文件时不发起请求（见 `troop-dedicated-portrait-manifest.json`），直接走稀有度通用图。
 */

import troopDedicatedManifest from '../../public/data/shared/troop-dedicated-portrait-manifest.json';

/** @type {Set<string>} */
const TROOP_DEDICATED_PORTRAIT_SHIPPED_IDS = new Set(
  Array.isArray(troopDedicatedManifest?.troopIds) ? troopDedicatedManifest.troopIds : [],
);

/** @type {Map<string, object>} */
let troopMetaById = new Map();

/**
 * 注入部队配置目录（`troops.json` 或 `{ troops: [...] }`）；可重复调用以热更新。
 * @param {{ troops?: object[] }|object[]} catalog
 */
export function configureTroopIconMetaCatalog(catalog) {
  const troops = Array.isArray(catalog) ? catalog : catalog?.troops ?? [];
  troopMetaById = new Map(
    troops.filter((t) => t && t.id).map((t) => [String(t.id), t]),
  );
}

/** @param {string} id */
export function getTroopIconMetaById(id) {
  if (!id) return null;
  return troopMetaById.get(String(id)) ?? null;
}

const RARITY_UI_PREFIX = {
  common: 'r1',
  rare: 'r2',
  epic: 'r3',
  legendary: 'r4',
  core: 'r4',
};

/**
 * 与 `battleConstants` 中地图素材一致：保证以「应用根」为基准，避免 SPA 子路由下
 * 相对路径 `assets/...` 被解析到错误目录导致专属 PNG 404、仅显示稀有度兜底图。
 * `baseUrl` 为空时使用当前包构建内联的 `import.meta.env.BASE_URL`（game / wiki 各自打包）。
 * @param {string} [baseUrl]
 * @returns {string} 始终以 `/` 结尾
 */
export function normalizeGamePublicBase(baseUrl) {
  let b =
    baseUrl != null && baseUrl !== ''
      ? String(baseUrl)
      : typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
        ? String(import.meta.env.BASE_URL)
        : '/';
  return b.endsWith('/') ? b : `${b}/`;
}

function troopUiCardTroopDir(baseUrl) {
  return `${normalizeGamePublicBase(baseUrl)}assets/san_1_ui_card/troop/`;
}

/** @deprecated 阶段 E 后战斗立绘不再按势力子目录；保留供旧调用兼容 */
const BATTLE_FACTION_SUBDIRS = new Set(['player', 'ally1', 'ally2', 'team', 'enemy']);

/**
 * @param {string} [faction] preset 部队行的 faction（如 enemy、ally1）
 * @returns {'player'|'ally1'|'ally2'|'team'|'enemy'}
 * @deprecated 仅兼容旧调用；缩略图已改卡面路径
 */
export function battleTroopSubdirForFaction(faction) {
  const f = String(faction ?? 'enemy').trim().toLowerCase();
  if (BATTLE_FACTION_SUBDIRS.has(f)) return /** @type {any} */ (f);
  return 'enemy';
}

function troopRarityFallbackFilename(troop) {
  const prefix = RARITY_UI_PREFIX[troop.rarity] || 'r1';
  const iconName = normalizeTroopWeaponIconName(troop);
  return `troop_${prefix}_${iconName}.png`;
}

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
  return `${troopUiCardTroopDir(baseUrl)}${troopRarityFallbackFilename(troop)}`;
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
  return `${troopUiCardTroopDir(baseUrl)}${id}.png`;
}

/**
 * 北疆（91xx，兼容旧 8xxx）/ 众生（90xx）：`_troop_` 后数字段首位为 8 或 9 时，与 core 相同先尝试 `{troop_id}.png`。
 * @param {string} id 已规范化的配置 ID（如 `san_1_troop_9101`）
 */
export function troopIdIsDedicatedSegment8Or9(id) {
  if (!id) return false;
  const m = String(id).match(/_troop_(\d)/);
  return m ? m[1] === '8' || m[1] === '9' : false;
}

/**
 * 是否优先尝试 **专属 `{配置ID}.png`**（再回退同目录 `troop_r*` 通用图）。
 */
export function troopPrefersDedicatedPortraitFile(troop) {
  if (troop && typeof troop === 'object' && troop.rarity === 'core') return true;
  const id = normalizeTroopAssetId(troop);
  return troopIdIsDedicatedSegment8Or9(id);
}

/** 卡面 / 战斗目录下是否已有 `{san_1_troop_*.png}` 专属立绘（无则跳过 404，直接用稀有度通用图） */
export function troopDedicatedPortraitFileShipped(troopOrId) {
  const id = normalizeTroopAssetId(troopOrId);
  if (!id) return false;
  return TROOP_DEDICATED_PORTRAIT_SHIPPED_IDS.has(id);
}

/**
 * 最多 2 个 URL：① 专属图（core / 91xx / 90xx，且 manifest 有登记）② 稀有度通用图。
 */
export function getTroopPortraitUrlAttempts(troop, baseUrl = '') {
  const rarityUrl = getTroopUiFolderFallbackUrl(troop, baseUrl);
  const id = normalizeTroopAssetId(troop);

  if (
    troopPrefersDedicatedPortraitFile(troop) &&
    id &&
    troopDedicatedPortraitFileShipped(id)
  ) {
    const idUrl = `${troopUiCardTroopDir(baseUrl)}${id}.png`; // san_1_ui_card/troop
    if (idUrl === rarityUrl) return [rarityUrl];
    return [idUrl, rarityUrl];
  }

  return [rarityUrl];
}

/**
 * 小型战斗地图等静态回退：与卡面同目录（序列帧优先走 battleUnitKey，无 key 时用此链）。
 * @param {object} troop
 * @param {string} [baseUrl]
 */
export function getBattleFieldTroopPortraitUrlAttempts(troop, baseUrl = '') {
  return getTroopPortraitUrlAttempts(troop, baseUrl);
}

/**
 * 大型图格上部队缩略图：与卡面同源（不再按势力子目录取战斗立绘）。
 * @param {string} troopId
 * @param {string} [baseUrl]
 * @param {string} [faction] 保留参数以兼容调用方；不影响路径
 * @returns {string[]}
 */
export function getMapTroopPortraitUrlAttempts(troopId, baseUrl = '', faction = 'enemy') {
  void faction;
  const id = normalizeTroopAssetId(troopId);
  const meta = getTroopIconMetaById(id);
  const stub = meta
    ? {
        id: meta.id,
        assetTroopId: meta.id,
        troopType: meta.troopType,
        rarity: meta.rarity,
        weaponType: meta.weaponType,
      }
    : {
        assetTroopId: id,
        troopType: 'infantry',
        rarity: 'common',
        weaponType: 'infantry_saber',
      };
  return getTroopPortraitUrlAttempts(stub, baseUrl);
}

export function getTroopCardPrimaryUrl(troop, baseUrl = '') {
  const list = getTroopPortraitUrlAttempts(troop, baseUrl);
  return list[0] || '';
}
