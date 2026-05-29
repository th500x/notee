/**
 * - **卡面 / 编组 / wiki**：`public/assets/san_1_ui_card/troop/` → `getTroopPortraitUrlAttempts`（无阵营子目录）。
 * - **8×10 战斗地图 / TroopLayer / bindTroopPortraitImg**：`public/assets/san_1_battle/{player|enemy}/`
 *   → `getBattleFieldTroopPortraitUrlAttempts`（敌我不同目录，同配置 ID 也区分立绘）。
 * - **战役大地图格**：`san_1_battle/{ally1|ally2|…}/` → `getCampaignMapTroopPortraitUrlAttempts`。
 *
 * 专属 `{配置ID}.png` 优先于 `troop_r{1-4}_{weapon}.png` 当且仅当：稀有度 **core**，或 **北疆 8xxx / 众生 9xxx**（`_troop_` 后数字首位为 8 或 9）。无同名 PNG 时回退稀有度通用图（卡面 `san_1_ui_card/troop/`、战斗瓦片 `san_1_battle/{player|enemy|ally…}/` 共用本判定）。
 */

import troopsCatalog from '../../public/data/shared/troops.json';

const RARITY_UI_PREFIX = {
  common: 'r1',
  rare: 'r2',
  epic: 'r3',
  legendary: 'r4',
  core: 'r4',
};

const troopMetaById = new Map((troopsCatalog.troops || []).map((t) => [t.id, t]));

/**
 * 与 `battleConstants` 中地图素材一致：保证以「应用根」为基准，避免 SPA 子路由（如 `/campaign-map-demo`）下
 * 相对路径 `assets/...` 被解析到错误目录导致专属 PNG 404、仅显示稀有度兜底图。
 * `baseUrl` 为空时使用当前包构建内联的 `import.meta.env.BASE_URL`（game / wiki 各自打包；如 `/campaign-map-manager` 子路由）。
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

/** 与 preset `quad_*_forces` / `san_1_battle` 子目录名一致 */
const BATTLE_FACTION_SUBDIRS = new Set(['player', 'ally1', 'ally2', 'team', 'enemy']);

/**
 * @param {string} [faction] preset 部队行的 faction（如 enemy、ally1）
 * @returns {'player'|'ally1'|'ally2'|'team'|'enemy'}
 */
export function battleTroopSubdirForFaction(faction) {
  const f = String(faction ?? 'enemy').trim().toLowerCase();
  if (BATTLE_FACTION_SUBDIRS.has(f)) return /** @type {any} */ (f);
  return 'enemy';
}

function battleTroopAssetDir(baseUrl, faction) {
  return `${normalizeGamePublicBase(baseUrl)}assets/san_1_battle/${battleTroopSubdirForFaction(faction)}/`;
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
 * 北疆（8xxx）/ 众生（9xxx）：`_troop_` 后数字段首位为 8 或 9 时，与 core 相同先尝试 `{troop_id}.png`。
 * @param {string} id 已规范化的配置 ID（如 `san_1_troop_9001`）
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

/**
 * 最多 2 个 URL：① 专属图（core / 8xxx / 9xxx）② 稀有度通用图。
 */
export function getTroopPortraitUrlAttempts(troop, baseUrl = '') {
  const rarityUrl = getTroopUiFolderFallbackUrl(troop, baseUrl);
  const id = normalizeTroopAssetId(troop);

  if (troopPrefersDedicatedPortraitFile(troop) && id) {
    const idUrl = `${troopUiCardTroopDir(baseUrl)}${id}.png`; // san_1_ui_card/troop
    if (idUrl === rarityUrl) return [rarityUrl];
    return [idUrl, rarityUrl];
  }

  return [rarityUrl];
}

/**
 * `san_1_battle/{subdir}/` 下立绘链（subdir 已由 `battleTroopSubdirForFaction` 规范为五档之一）。
 * @param {object} troop 含 id/rarity/weaponType 等
 * @param {string} subdir player|enemy|ally1|…
 */
function troopPortraitAttemptsSan1BattleSubdir(troop, baseUrl, subdir) {
  const dir = battleTroopAssetDir(baseUrl, subdir);
  const rarityUrl = `${dir}${troopRarityFallbackFilename(troop)}`;
  const pid = normalizeTroopAssetId(troop);
  if (troopPrefersDedicatedPortraitFile(troop) && pid) {
    const idUrl = `${dir}${pid}.png`;
    if (idUrl === rarityUrl) return [rarityUrl];
    return [idUrl, rarityUrl];
  }
  return [rarityUrl];
}

/**
 * 小型战斗地图等：`troop.faction === 'player'` → `san_1_battle/player/`，否则 → `enemy/`。
 * 我方：在战斗目录专属图缺失时，**先接卡面目录** `san_1_ui_card/troop/` 再回退战斗稀有度通用图，避免与编组卡面立绘不一致。
 */
export function getBattleFieldTroopPortraitUrlAttempts(troop, baseUrl = '') {
  const subdir = troop && troop.faction === 'player' ? 'player' : 'enemy';
  const battleAttempts = troopPortraitAttemptsSan1BattleSubdir(troop, baseUrl, subdir);
  if (subdir !== 'player') return battleAttempts;
  const cardAttempts = getTroopPortraitUrlAttempts(troop, baseUrl);
  const seen = new Set();
  const merged = [];
  for (const url of [...cardAttempts, ...battleAttempts]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    merged.push(url);
  }
  return merged.length > 0 ? merged : battleAttempts;
}

/**
 * 战役地图格上部队缩略图：`san_1_battle/{faction}/`（与 `quad_*_forces` 五档子目录一致）。
 * @param {string} troopId
 * @param {string} [baseUrl]
 * @param {string} [faction] 来自 units_spec 行首 faction（如 enemy、ally1）
 * @returns {string[]}
 */
export function getCampaignMapTroopPortraitUrlAttempts(troopId, baseUrl = '', faction = 'enemy') {
  const id = normalizeTroopAssetId(troopId);
  const meta = id ? troopMetaById.get(id) : null;
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
  const sub = battleTroopSubdirForFaction(faction);
  const primary = troopPortraitAttemptsSan1BattleSubdir(stub, baseUrl, sub);
  // 仓库当前仅保证 `san_1_battle/ally1/` 有素材；ally2 格若无对应目录则 404，
  // 追加 ally1 同名链，浏览器仍会尝试加载但最终能落到稀有度兜底图。
  if (sub === 'ally2') {
    const fb = troopPortraitAttemptsSan1BattleSubdir(stub, baseUrl, 'ally1');
    const seen = new Set(primary);
    for (const u of fb) {
      if (!seen.has(u)) {
        primary.push(u);
        seen.add(u);
      }
    }
  }
  return primary;
}

export function getTroopCardPrimaryUrl(troop, baseUrl = '') {
  const list = getTroopPortraitUrlAttempts(troop, baseUrl);
  return list[0] || '';
}
