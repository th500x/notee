/**
 * AI 玩家上阵编组（Step 2）。
 *
 * 战斗类动作（匪寨 / 探索惩罚战 / auto-duel / 道路·攻城 PVP）前调用：把背包内**最高稀有度**的
 * 将领、部队，以及可用的装备卡 / 称号 / 成就 / 宝物，通过既有
 * `playerCardLineupService.equipCard` 上阵，尽量满足 `MIN_MAIN_LINEUP_TROOPS_BATTLE`。
 *
 * **复用既有 equip 语义**：装备/卸下/特效重算一律走 `equipCard`，不复制第二套上阵实现
 * （见 notee-code-quality §3、san-storm-tactical-ui-consistency）。槽位口径与前端 `LineupTab`
 * 一致：玩家 1 个部队槽（`player/troop`），每名已上阵将领额外 2 个部队槽（`troop1`/`troop2`），
 * 将领须先上阵其部队槽才可用。
 *
 * 设计文档：docs/01-jun-exploration/40-ai/42-1-AI_PLAYER_SYSTEM.md §7.3，42-2-AI_PLAYER_IMPLEMENTATION.md Step 2。
 */

const { pool } = require('../database/connection');
const { equipCard, repairLineupCharacterCards } = require('./playerCardLineupService');
const garrisonService = require('./garrisonService');

const { MIN_MAIN_LINEUP_TROOPS_BATTLE } = garrisonService;

// 与前端 lineupSlots.RARITY_ORDER 一致（白 < 蓝 < 紫 < 橙 < 金）
const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };
const rarityRank = (r) => RARITY_ORDER[r] ?? -1;
const byRarityDesc = (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity);

// 非部队加成槽：card_type 与 equipped_slot 同名
const BONUS_SLOT_TYPES = ['equipmentSet', 'title', 'achievement', 'treasure'];

function isBarracksStored(card) {
  const v = card.main_city_barracks_storage;
  return v === 1 || v === true || String(v) === '1';
}

// 部队耐久过期可上阵判定（与 LineupTab.getAvailableCards 同口径）：
// 未过期可上阵；已过期仅 legendary 仍可上阵（common/rare/epic/core 过期不可装）。
function troopEquippable(card) {
  const max = card.max_battle_count ?? 10;
  const used = Math.max(0, card.battle_count ?? 0);
  const expired = used >= max;
  if (!expired) return true;
  return card.rarity === 'legendary';
}

// 宝物可用判定（与 equipCard 一致：uses_remaining 为空或 > 0）
function treasureUsable(card) {
  return card.uses_remaining == null || Number(card.uses_remaining) > 0;
}

function alreadyInSlot(card, slot) {
  return (
    card.is_equipped &&
    card.equipped_by === slot.equippedBy &&
    card.equipped_slot === slot.equippedSlot
  );
}

/**
 * 把已排序（最优在前）的候选卡分配到目标槽位：
 * 取前 N（N=槽位数）为目标集合；已正确就位者保持不动，其余装入空槽（`equipCard` 会自动顶替旧卡）。
 * @param {string} playerId
 * @param {Array<{equippedBy:string, equippedSlot:string}>} slots
 * @param {Array<object>} candidatesSorted 已按稀有度降序、且已过滤可用性
 * @param {Set<string>} used 本轮已被占用的 instance_id（跨槽组防重复）
 * @returns {Promise<number>} 实际新装备的张数
 */
async function assignBest(playerId, slots, candidatesSorted, used) {
  const pool0 = candidatesSorted.filter((c) => !used.has(c.instance_id));
  const desired = pool0.slice(0, slots.length);
  const free = [...slots];
  const toPlace = [];

  for (const card of desired) {
    const idx = free.findIndex((s) => alreadyInSlot(card, s));
    if (idx >= 0) {
      free.splice(idx, 1);
      used.add(card.instance_id);
    } else {
      toPlace.push(card);
    }
  }

  let equipped = 0;
  for (const card of toPlace) {
    if (free.length === 0) break;
    const slot = free.shift();
    const res = await equipCard(playerId, {
      instanceId: card.instance_id,
      equippedBy: slot.equippedBy,
      equippedSlot: slot.equippedSlot,
    });
    if (res.ok) {
      used.add(card.instance_id);
      equipped += 1;
    } else {
      // 不静默吞错：过期/耐久类已在候选过滤排除，走到这里属意外
      console.error(
        `[aiPlayer][lineup] equip 失败 player=${playerId} card=${card.instance_id} → ${slot.equippedBy}/${slot.equippedSlot}: ${res.error}`,
      );
    }
  }
  return equipped;
}

/**
 * 刷新某 AI 玩家的上阵编组，使其尽量以最高稀有度卡上阵并满足战斗兵力下限。
 * @param {string} playerId
 * @returns {Promise<{ playerId: string, generals: number, troopSlots: number, mainLineupTroops: number, meetsBattleGate: boolean }>}
 */
async function refreshAiPlayerLineup(playerId) {
  await repairLineupCharacterCards(pool, playerId);

  const [cards] = await pool.query(
    `SELECT instance_id, card_type, card_id, rarity, is_equipped, equipped_by, equipped_slot,
            battle_count, max_battle_count, uses_remaining, main_city_barracks_storage
       FROM player_cards WHERE player_id = ?`,
    [playerId],
  );
  const occupied = await garrisonService.getGarrisonOccupiedInstanceIds(playerId);
  const usable = cards.filter((c) => !occupied.has(c.instance_id) && !isBarracksStored(c));

  const used = new Set();

  // 1. 将领：最多 2 名，最高稀有度，装入 character1 / character2 的将领槽
  const charSlots = [
    { equippedBy: 'character1', equippedSlot: 'character' },
    { equippedBy: 'character2', equippedSlot: 'character' },
  ];
  const charPool = usable.filter((c) => c.card_type === 'character').sort(byRarityDesc);
  await assignBest(playerId, charSlots, charPool, used);

  // 2. 重新确认哪些将领位已上阵（决定可用的部队槽）
  const [equippedChars] = await pool.query(
    `SELECT equipped_by FROM player_cards
      WHERE player_id = ? AND card_type = 'character' AND is_equipped = TRUE AND equipped_slot = 'character'`,
    [playerId],
  );
  const hasGeneral = new Set(equippedChars.map((r) => r.equipped_by));

  // 3. 部队：玩家槽 + 每名已上阵将领的两个部队槽，最高稀有度优先
  const troopSlots = [{ equippedBy: 'player', equippedSlot: 'troop' }];
  for (const by of ['character1', 'character2']) {
    if (hasGeneral.has(by)) {
      troopSlots.push({ equippedBy: by, equippedSlot: 'troop1' });
      troopSlots.push({ equippedBy: by, equippedSlot: 'troop2' });
    }
  }
  const troopPool = usable
    .filter((c) => c.card_type === 'troop' && troopEquippable(c))
    .sort(byRarityDesc);
  await assignBest(playerId, troopSlots, troopPool, used);

  // 4. 加成槽（装备卡 / 称号 / 成就 / 宝物）：玩家 + 已上阵将领各一个，最高稀有度优先
  const bonusOwners = ['player', ...['character1', 'character2'].filter((by) => hasGeneral.has(by))];
  for (const slotType of BONUS_SLOT_TYPES) {
    const slots = bonusOwners.map((by) => ({ equippedBy: by, equippedSlot: slotType }));
    let candidates = usable.filter((c) => c.card_type === slotType);
    if (slotType === 'treasure') candidates = candidates.filter(treasureUsable);
    candidates.sort(byRarityDesc);
    await assignBest(playerId, slots, candidates, used);
  }

  const mainLineupTroops = await garrisonService.sumMainLineupEquippedTroopTroops(pool, playerId);
  return {
    playerId,
    generals: hasGeneral.size,
    troopSlots: troopSlots.length,
    mainLineupTroops,
    meetsBattleGate: mainLineupTroops >= MIN_MAIN_LINEUP_TROOPS_BATTLE,
  };
}

module.exports = {
  refreshAiPlayerLineup,
};
