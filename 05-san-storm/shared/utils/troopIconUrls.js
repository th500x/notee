/**
 * - **卡面 / 编组 / wiki**：`public/assets/san_1_ui_card/troop/` → `getTroopPortraitUrlAttempts`（无阵营子目录）。
 * - **8×10 战斗地图 / TroopLayer / bindTroopPortraitImg**：`public/assets/san_1_battle/{player|enemy}/`
 *   → `getBattleFieldTroopPortraitUrlAttempts`（敌我不同目录，同配置 ID 也区分立绘）。
 * - **战役大地图格**：`san_1_battle/{ally1|ally2|…}/` → `getCampaignMapTroopPortraitUrlAttempts`。
 *
 * 专属 `{配置ID}.png` 优先于 `troop_r{1-4}_{weapon}.png` 当且仅当：稀有度 **core**，或 **遗留 x 形 troop_id**（库中若仍有）；战役段多用 `san_1_troop_9xxx` + 同名 PNG。
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
 * 遗留 x 形：`san_1_troop_` 后缀为「十进制数字 + `x` + 其余」时，与 core 相同优先读专属 ID 图（若库中仍有）。战役专用部队推荐 `san_1_troop_9xxx` + 同名 PNG。
 * @param {string} id 已规范化的配置 ID
 */
export function troopIdIsSpecialWildcardForm(id) {
  if (!id || !id.startsWith('san_1_troop_')) return false;
  const suffix = id.slice('san_1_troop_'.length);
  return /^\d+x/i.test(suffix);
}

/**
 * 是否优先尝试 **专属 `{配置ID}.png`**（再回退同目录 `troop_r*` 通用图）。
 */
export function troopPrefersDedicatedPortraitFile(troop) {
  if (troop && typeof troop === 'object' && troop.rarity === 'core') return true;
  const id = normalizeTroopAssetId(troop);
  return troopIdIsSpecialWildcardForm(id);
}

/**
 * 最多 2 个 URL：① 专属图（core 或特殊 x 形 ID）② 稀有度通用图。
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
 */
export function getBattleFieldTroopPortraitUrlAttempts(troop, baseUrl = '') {
  const subdir = troop && troop.faction === 'player' ? 'player' : 'enemy';
  return troopPortraitAttemptsSan1BattleSubdir(troop, baseUrl, subdir);
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
