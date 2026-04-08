/**
 * 小型战术图（8×10）PVE 敌方编组：按槽位稀有度从 config 池抽样将领 + 部队。
 * 事件战（全槽同一稀有度）、匪寨（混合稀有度）等共用。
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
function pickCharForRarity(allCharacters, rarity, excludeIds) {
  const want = normalizeBattleRarity(rarity);
  const pool = allCharacters.filter(
    (ch) => normalizeBattleRarity(ch.rarity) === want && !excludeIds.has(ch.id),
  );
  const src = pool.length > 0 ? pool : allCharacters.filter((ch) => !excludeIds.has(ch.id));
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
  if (c0?.id) ex.add(c0.id);
  const c1 = pickCharForRarity(allCharacters, rPair1, ex);

  const fallbackTroop = allTroops[0] || null;
  const troops = [];
  for (let i = 0; i < 4; i++) {
    troops.push(pickTroopForSlot(allTroops, slots[i]) || fallbackTroop);
  }

  return { pairChars: [c0, c1], troops, slotRarities: slots };
}
