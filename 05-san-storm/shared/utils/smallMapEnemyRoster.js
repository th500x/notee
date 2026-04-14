/**
 * 小型战术图（8×10）PVE 敌方编组：按槽位稀有度从 config 池抽样将领 + 部队。
 * **匪寨难度档 `BANDIT_NPC_SLOTS_BY_TIER` 为统一基准**；探索事件战、攻城 NPC（`cityService.generateNpcGarrison`）与此对齐 — 见 `docs/20-data-layer/22-1-TROOP_SYSTEM.md` §九。
 *
 * 随机敌方部队池：使用 `*_troop_8xxx`（S1 对应势力 `san_1_faction_8001` 北疆 NPC），
 * 不使用黄巾常规 `*_troop_7xxx` 池（避免与小型图 PVE 需求混淆）。战役专用见 `*_troop_9xxx`（众生）。见 `filterTroopsForSmallMapPveEnemy`。
 *
 * @module @shared/utils/smallMapEnemyRoster
 */

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'core'];

/** @param {string} r */
export function normalizeBattleRarity(r) {
  const x = String(r || '').toLowerCase();
  if (x === 'core' || x === 'legendary' || x === 'epic' || x === 'rare' || x === 'common') return x;
  return 'common';
}

/** @param {...string} rarities */
export function bestRarityOf(...rarities) {
  let best = 'common';
  let idx = 0;
  for (const r of rarities) {
    const n = normalizeBattleRarity(r);
    const i = RARITY_ORDER.indexOf(n);
    if (i > idx) {
      idx = i;
      best = n;
    }
  }
  return best;
}

/** 探索事件等：四面敌方均为同一稀有度 */
export function uniformSmallMapSlotRarities(eventRarity) {
  const t = normalizeBattleRarity(eventRarity);
  return [t, t, t, t];
}

/** 匪寨等：难度档（与普通/稀有卡牌稀有度同名，勿与「关卡层」混淆） */
export const BANDIT_NPC_SLOTS_BY_TIER = {
  normal: ['common', 'common', 'rare', 'rare'],
  rare: ['rare', 'rare', 'epic', 'epic'],
  epic: ['epic', 'epic', 'legendary', 'legendary'],
  legendary: ['legendary', 'legendary', 'legendary', 'legendary'],
};

/**
 * 战略地图匪寨格 ID（独立地图对象，非 `san_*_city_{1-7}_*`）。格式：`san_{赛季}_bandit_{1-9}_{区域 slug}`。
 * @see `docs/00-base/04-1-ID_NAMING_GUIDE.md` §15
 */
export const BANDIT_MAP_OBJECT_ID_RE = /^san_\d+_bandit_[1-9]_[a-z0-9_]+$/i;

/** @param {string|null|undefined} id */
export function isBanditMapObjectId(id) {
  return BANDIT_MAP_OBJECT_ID_RE.test(String(id ?? '').trim());
}

/**
 * 探索事件惩罚战：当前探索点 `city_id` 符合 {@link isBanditMapObjectId} 时使用，四槽均为传奇。
 * 与匪寨玩法层数、爬层产出等无关；攻城/NPC 走 {@link resolveCityBanditTier}。
 */
export const EVENT_PUNISHMENT_COMBAT_BANDIT_LOCATION_SLOT_RARITIES = [
  ...BANDIT_NPC_SLOTS_BY_TIER.legendary,
];

/**
 * 匪寨层数 1…12 → 难度档
 * @param {number} layer
 * @returns {'normal'|'rare'|'epic'|'legendary'}
 */
export function banditTierFromLayer(layer) {
  const n = Math.max(1, Math.min(12, Math.floor(Number(layer) || 1)));
  if (n <= 3) return 'normal';
  if (n <= 6) return 'rare';
  if (n <= 9) return 'epic';
  return 'legendary';
}

/** @param {number} layer */
export function banditNpcSlotRaritiesFromLayer(layer) {
  const tier = banditTierFromLayer(layer);
  return [...BANDIT_NPC_SLOTS_BY_TIER[tier]];
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

/**
 * S1 北疆 NPC 等：`san_1_troop_8001`…（`san_1_faction_8001` 部队段）。
 * @param {string|null|undefined} troopId
 */
export function isSmallMapPveNpcTroopId(troopId) {
  return /_troop_8\d{3}/.test(String(troopId ?? ''));
}

/**
 * @param {Array<object>} allTroops - config 全量部队
 * @returns {Array<object>} 优先仅含 8xxx 段；若无则回退全量（避免空池）
 */
export function filterTroopsForSmallMapPveEnemy(allTroops) {
  const list = Array.isArray(allTroops) ? allTroops : [];
  const band = list.filter((tr) => isSmallMapPveNpcTroopId(tr?.id));
  return band.length > 0 ? band : list;
}

function troopRowId(tr) {
  return tr?.id ?? tr?.troop_id ?? '';
}

function pickTroopForSlot(allTroops, rarity) {
  const want = normalizeBattleRarity(rarity);
  const pool = allTroops.filter((tr) => normalizeBattleRarity(tr.rarity) === want);
  const src = pool.length > 0 ? pool : allTroops;
  const s = shuffle(src);
  return s[0] || null;
}

/**
 * @param {Array<{ id: string }>} allCharacters
 * @param {string} rarity
 * @param {Set<string>} excludeIds
 */
function charRowId(ch) {
  return ch?.id ?? ch?.character_id ?? '';
}

function pickCharForRarity(allCharacters, rarity, excludeIds) {
  const want = normalizeBattleRarity(rarity);
  const pool = allCharacters.filter(
    (ch) =>
      normalizeBattleRarity(ch.rarity) === want && !excludeIds.has(charRowId(ch)),
  );
  const src = pool.length > 0 ? pool : allCharacters.filter((ch) => !excludeIds.has(charRowId(ch)));
  const s = shuffle(src);
  return s[0] || null;
}

/**
 * 四面敌方（2 将领位 × 各带 2 部队）：按每槽稀有度抽部队；将领按「每对槽位最高稀有度」抽两人，尽量不重复。
 *
 * @param {Array<object>} allTroops - config 部队
 * @param {Array<object>} allCharacters - config 将领
 * @param {string[]} slotRarities - 长度 4
 * @returns {{ pairChars: [object|null, object|null], troops: Array<object|null>, slotRarities: string[] }}
 */
export function buildSmallMapEnemyRosterPicks(allTroops, allCharacters, slotRarities) {
  const slots =
    Array.isArray(slotRarities) && slotRarities.length === 4
      ? slotRarities.map(normalizeBattleRarity)
      : uniformSmallMapSlotRarities('common');

  const rPair0 = bestRarityOf(slots[0], slots[1]);
  const rPair1 = bestRarityOf(slots[2], slots[3]);

  const ex = new Set();
  const c0 = pickCharForRarity(allCharacters, rPair0, ex);
  const c0id = charRowId(c0);
  if (c0id) ex.add(c0id);
  const c1 = pickCharForRarity(allCharacters, rPair1, ex);

  const fallbackTroop = allTroops[0] || null;
  const troops = [];
  for (let i = 0; i < 4; i++) {
    troops.push(pickTroopForSlot(allTroops, slots[i]) || fallbackTroop);
  }

  return { pairChars: [c0, c1], troops, slotRarities: slots };
}

// ── PVE 统一：匪寨难度档为基准；攻城 NPC / 探索事件战共用槽位组合与势力池规则（见 22-1-TROOP_SYSTEM.md） ──

/** 小型图 PVE 默认敌方势力（北疆 NPC，`san_1_troop_8xxx`） */
export const PVE_NPC_DEFAULT_FACTION_ID = 'san_1_faction_8001';

/**
 * `san_1_faction_XXXX` → 配置 ID 段首位（`troops`/`characters` 的 `san_1_troop_1xxx` / `san_1_char_1xxx`）
 * @param {string|null|undefined} factionId
 * @returns {string|null}
 */
export function factionIdToConfigIdLeadingDigit(factionId) {
  const m = String(factionId || '').match(/san_1_faction_(\d{4})/);
  return m ? m[1][0] : null;
}

/**
 * 按势力过滤部队配置行（`id` 或 `troop_id`）；池为空则回退全量，避免生成失败。
 * @param {Array<object>} allTroops
 * @param {string|null|undefined} factionId
 */
export function filterTroopsByFactionId(allTroops, factionId) {
  const list = Array.isArray(allTroops) ? allTroops : [];
  const d = factionIdToConfigIdLeadingDigit(factionId);
  if (!d) return list;
  const re = new RegExp(`^san_1_troop_${d}\\d{3}$`);
  const hit = list.filter((t) => re.test(String(troopRowId(t))));
  return hit.length > 0 ? hit : list;
}

/**
 * 按势力过滤将领配置行；池为空则回退全量。
 * @param {Array<object>} allCharacters
 * @param {string|null|undefined} factionId
 */
export function filterCharactersByFactionId(allCharacters, factionId) {
  const list = Array.isArray(allCharacters) ? allCharacters : [];
  const d = factionIdToConfigIdLeadingDigit(factionId);
  if (!d) return list;
  const re = new RegExp(`^san_1_char_${d}\\d`);
  const hit = list.filter((c) => re.test(String(charRowId(c))));
  return hit.length > 0 ? hit : list;
}

/**
 * 攻城 NPC 部队/将领池：`faction_0001` 或无归属 → 北疆；否则 → 城市 `faction_id` 对应段。
 * @param {{ faction_id?: string|null, factionId?: string|null }} city
 */
export function resolveSiegeNpcFactionIdForTroopPool(city) {
  const fid = city?.faction_id ?? city?.factionId;
  if (!fid || fid === 'san_1_faction_0001') return PVE_NPC_DEFAULT_FACTION_ID;
  return fid;
}

/**
 * 城市类型 → 匪寨难度档（槽位组合见 `BANDIT_NPC_SLOTS_BY_TIER`）
 * 小城→normal；中城/据点→rare；大城/关隘→epic。
 * @param {string|null|undefined} cityType
 * @returns {'normal'|'rare'|'epic'|'legendary'}
 */
export function cityTypeToBanditTier(cityType) {
  switch (cityType) {
    case 'city_small':
      return 'normal';
    case 'city_medium':
    case 'fort':
      return 'rare';
    case 'city_major':
    case 'gate':
      return 'epic';
    default:
      return 'normal';
  }
}

/**
 * 城市格点 → 匪寨难度档（攻城 NPC 等）：`city_id` 为匪寨地图对象时固定一档，否则按城市 `city_type`。
 * @param {string|null|undefined} cityType
 * @param {string|null|undefined} cityId
 * @returns {'normal'|'rare'|'epic'|'legendary'}
 */
export function resolveCityBanditTier(cityType, cityId) {
  if (isBanditMapObjectId(cityId)) return 'normal';
  return cityTypeToBanditTier(cityType);
}

/**
 * 事件卡稀有度 / 事件模板 ID 末段 → 匪寨档（探索战与匪寨一致；`core` 与传奇档相同组合）
 * @param {string|null|undefined} cardRarity
 */
export function eventCardRarityToBanditTier(cardRarity) {
  const r = normalizeBattleRarity(cardRarity);
  if (r === 'core') return 'legendary';
  const map = {
    common: 'normal',
    rare: 'rare',
    epic: 'epic',
    legendary: 'legendary',
  };
  return map[r] || 'normal';
}

/**
 * @param {'normal'|'rare'|'epic'|'legendary'} tier
 * @returns {string[]}
 */
export function banditTierSlotRarities(tier) {
  const t = BANDIT_NPC_SLOTS_BY_TIER[tier] || BANDIT_NPC_SLOTS_BY_TIER.normal;
  return [...t];
}

/**
 * 供后端攻城循环：按索引循环匪寨四槽稀有度。
 * @param {number} index
 * @param {'normal'|'rare'|'epic'|'legendary'} tier
 */
export function siegeNpcRarityAtTroopIndex(index, tier) {
  const slots = banditTierSlotRarities(tier);
  return normalizeBattleRarity(slots[Number(index) % 4]);
}

/**
 * 一对连续部队槽（2 支）对应的将领稀有度：取两槽较高档（与 `buildSmallMapEnemyRosterPicks` 两对位一致）
 * @param {number} pairStartIndex — 偶数：0,2,4,…
 */
export function siegeNpcCharRarityForPair(pairStartIndex, tier) {
  const slots = banditTierSlotRarities(tier);
  const a = normalizeBattleRarity(slots[Number(pairStartIndex) % 4]);
  const b = normalizeBattleRarity(slots[(Number(pairStartIndex) + 1) % 4]);
  return bestRarityOf(a, b);
}

/** 攻城 NPC 循环抽将（与小型图一致） */
export function pickRandomTroopByRarity(allTroops, rarity) {
  return pickTroopForSlot(allTroops, rarity);
}

export function pickRandomCharacterByRarity(allCharacters, rarity) {
  return pickCharForRarity(allCharacters, rarity, new Set());
}
