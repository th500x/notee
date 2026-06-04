/**
 * 小型地图 PVE 战后掉落与资源：攻城 NPC 线、匪寨等共用。
 * - 攻城 NPC 胜利：按「每支被击杀 NPC 的稀有度」累加贡献 + 装备掷骰仍按本场最高稀有度池
 * - 匪寨等声明式奖励仍可走 `applyDeclaredSmallMapPveLoot`（可含声望）
 * - 或：战报附带声明式每层奖励（reputation/silver/food + 同规则装备掷骰）
 *
 * @module services/smallMapBattleLootService
 */

const { pool } = require('../database/connection');
const statisticsDeltaService = require('./statisticsDeltaService');
const { WIN_CONTRIBUTION_REWARD_SIEGE_NPC } = require('../../shared/utils/siegeKillEconomyByRarity.cjs');

const EQUIPMENT_DROP_RATE = 0.05;

/** 胜利声望（按击杀/对局敌方最高稀有度）；驻守玩家攻城线等仍可用 */
const WIN_REPUTATION_REWARD = {
  core: 25,
  legendary: 20,
  epic: 15,
  rare: 10,
  common: 5,
};

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'core'];

function normalizeRarity(r) {
  const x = String(r || '').toLowerCase();
  if (x === 'core' || x === 'legendary' || x === 'epic' || x === 'rare' || x === 'common') return x;
  return 'common';
}

/**
 * 从击杀列表取最高稀有度（装备池 / 胜利声望表共用）。
 * @param {string[]} rarities
 * @returns {string}
 */
function pickBestRarityFromKills(rarities) {
  const arr = (Array.isArray(rarities) ? rarities : [])
    .map((r) => normalizeRarity(r))
    .filter(Boolean);
  if (!arr.length) return 'common';
  return arr.sort((a, b) => RARITY_ORDER.indexOf(b) - RARITY_ORDER.indexOf(a))[0];
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} playerId
 * @param {string} bestEnemyRarity
 * @param {string} [season]
 * @returns {Promise<object|null>} equipmentDrop
 */
async function tryRollEquipmentDrop(connection, playerId, bestEnemyRarity, season = 'san_1') {
  if (Math.random() >= EQUIPMENT_DROP_RATE) return null;
  const best = normalizeRarity(bestEnemyRarity);
  const rarityDigit = { common: '1', rare: '2', epic: '3', legendary: '4', core: '5' }[best] || '2';
  const idRegexp = `^${season}_equip_[1-3]_${rarityDigit}[0-9]{3}$`;
  const [equipRows] = await connection.query(
    `SELECT * FROM config_equipment WHERE season = ? AND equipment_id REGEXP ? ORDER BY RAND() LIMIT 1`,
    [season, idRegexp],
  );
  if (!equipRows || !equipRows.length) return null;
  const eq = equipRows[0];
  const instanceId = `equip_${playerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const eqRarity =
    { 1: 'common', 2: 'rare', 3: 'epic', 4: 'legendary', 5: 'core' }[
      eq.equipment_id.match(/_(\d)\d{3}$/)?.[1]
    ] || best;
  await connection.query(
    `INSERT INTO player_cards (instance_id, player_id, card_type, card_id, rarity, is_equipped)
     VALUES (?, ?, 'equipment', ?, ?, FALSE)`,
    [instanceId, playerId, eq.equipment_id, eqRarity],
  );
  return { instanceId, equipmentId: eq.equipment_id, name: eq.equipment_name, rarity: eqRarity };
}

/**
 * 攻城 NPC：胜利且有击杀时，声望 + 装备掷骰（单 connection 事务内调用）。
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} playerId
 * @param {string} bestEnemyRarity
 * @returns {Promise<{ reputationReward: number, equipmentDrop: object|null }>}
 */
async function grantWinReputationAndEquipment(connection, playerId, bestEnemyRarity) {
  const br = normalizeRarity(bestEnemyRarity);
  const reputationReward = WIN_REPUTATION_REWARD[br] || 5;
  await connection.query('UPDATE players SET reputation = reputation + ? WHERE player_id = ?', [
    reputationReward,
    playerId,
  ]);
  const equipmentDrop = await tryRollEquipmentDrop(connection, playerId, br);
  return { reputationReward, equipmentDrop };
}

/**
 * 攻城 NPC：胜利且有击杀时，按每支被击杀单位的稀有度累加贡献；装备 5% 掷骰仍取本场最高稀有度（单 connection 事务内）。
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} playerId
 * @param {string[]} killedUnitRarities 与「实际从 alive→dead」的击杀一一对应，每支一条稀有度
 * @returns {Promise<{ contributionReward: number, equipmentDrop: object|null }>}
 */
async function grantWinContributionAndEquipment(connection, playerId, killedUnitRarities) {
  const arr = Array.isArray(killedUnitRarities) ? killedUnitRarities : [];
  let contributionReward = 0;
  for (const r of arr) {
    const br = normalizeRarity(r);
    contributionReward += WIN_CONTRIBUTION_REWARD_SIEGE_NPC[br] ?? 1;
  }
  if (contributionReward > 0) {
    await connection.query('UPDATE players SET contribution = GREATEST(0, contribution + ?) WHERE player_id = ?', [
      contributionReward,
      playerId,
    ]);
  }
  const bestForDrop = pickBestRarityFromKills(arr);
  const equipmentDrop = await tryRollEquipmentDrop(connection, playerId, bestForDrop);
  return { contributionReward, equipmentDrop };
}

/**
 * 客户端在 POST /api/battles 的 rewards.smallMapPveLoot 中声明的银两/粮草/声望 + 可选装备掷骰
 *（匪寨每层即时发奖等；与事件 JSON /rewards 配置链路独立，避免双发）。
 *
 * @param {string} playerId
 * @param {object} loot
 * @param {number} [loot.reputation]
 * @param {number} [loot.silver]
 * @param {number} [loot.food]
 * @param {string} [loot.bestEnemyRarity]
 * @param {boolean} [loot.rollEquipment=true]
 */
async function applyDeclaredSmallMapPveLoot(playerId, loot) {
  if (!loot || typeof loot !== 'object') return { applied: false, equipmentDrop: null };

  const reputation = Math.floor(Number(loot.reputation) || 0);
  const silver = Math.floor(Number(loot.silver) || 0);
  const food = Math.floor(Number(loot.food) || 0);
  const bestEnemyRarity = normalizeRarity(loot.bestEnemyRarity || 'common');
  const rollEquipment = loot.rollEquipment !== false;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (reputation !== 0) {
      await connection.query('UPDATE players SET reputation = reputation + ? WHERE player_id = ?', [
        reputation,
        playerId,
      ]);
    }
    if (silver !== 0) {
      await connection.query('UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?', [
        silver,
        playerId,
      ]);
    }
    if (food !== 0) {
      await connection.query('UPDATE players SET food = GREATEST(0, food + ?) WHERE player_id = ?', [
        food,
        playerId,
      ]);
    }
    let equipmentDrop = null;
    if (rollEquipment) {
      equipmentDrop = await tryRollEquipmentDrop(connection, playerId, bestEnemyRarity);
    }
    await connection.commit();

    await statisticsDeltaService.recordEarned(playerId, {
      ...(reputation > 0 ? { reputation } : {}),
      ...(silver > 0 ? { silver } : {}),
      ...(food > 0 ? { food } : {}),
    });

    return { applied: true, equipmentDrop };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

module.exports = {
  EQUIPMENT_DROP_RATE,
  WIN_REPUTATION_REWARD,
  WIN_CONTRIBUTION_REWARD_SIEGE_NPC,
  normalizeRarity,
  pickBestRarityFromKills,
  tryRollEquipmentDrop,
  grantWinReputationAndEquipment,
  grantWinContributionAndEquipment,
  applyDeclaredSmallMapPveLoot,
};
