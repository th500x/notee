/**
 * 卡池抽取服务（临时模拟方案）
 * 
 * @description 模拟满发展度3000的卡池抽取，未来可迁移到正式势力抽卡系统
 * @module backend/services/cardPoolService
 */

const { pool } = require('../database/connection');

// ── 概率配置（模拟满发展度3000）─────────────────────────────

const DRAW_PROBABILITIES = {
  legendary: 0.05,
  epic:      0.10,
  rare:      0.30,
  common:    0.55,
};

// ── 抽取限制 ─────────────────────────────────────────────────

const DAILY_DRAW_LIMIT = 5;
const DRAW_COST = 40;
const PITY_THRESHOLD = 50;
const EXPIRES_DAYS = 14;

const DAILY_RARITY_CAP = { legendary: 1, epic: 2 };

// ── 补偿常量 ─────────────────────────────────────────────────

const CHARACTER_DUPLICATE_COMPENSATION = { common: 20, rare: 40, epic: 60, legendary: 80 };
const TROOP_OVER_LIMIT_COMPENSATION = { common: 100, rare: 200, epic: 300, legendary: 400 };
const TROOP_LIMIT_BY_RARITY = { common: 20, rare: 20, epic: 20, legendary: 20 };
const MAX_BATTLE_COUNT = { common: 20, rare: 40, epic: 60, legendary: 80 };

// ── 工具函数 ─────────────────────────────────────────────────

function rollRarity() {
  const rand = Math.random();
  let cumulative = 0;
  for (const [rarity, prob] of Object.entries(DRAW_PROBABILITIES)) {
    cumulative += prob;
    if (rand < cumulative) return rarity;
  }
  return 'common';
}

function parseFactionId(factionId) {
  const parts = factionId.split('_');
  return {
    season: parts.slice(0, 2).join('_'),
    factionNumber: parts[3] ? parts[3].charAt(0) : '0',
  };
}

// ── 核心：抽取卡牌 ───────────────────────────────────────────

/**
 * 执行卡池抽取
 * 
 * @param {string} playerId - 玩家ID
 * @param {'troop'|'character'} poolType - 卡池类型
 * @returns {Promise<Object>} 抽取结果
 */
async function drawFromPool(playerId, poolType) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. 获取玩家信息
    const [playerRows] = await connection.query(
      'SELECT player_id, silver, faction_id FROM players WHERE player_id = ?',
      [playerId]
    );
    if (playerRows.length === 0) throw new Error('玩家不存在');
    const player = playerRows[0];

    // 2. 检查银两
    if (player.silver < DRAW_COST) {
      throw new Error(`银两不足，需要${DRAW_COST}银两，当前${player.silver}银两`);
    }

    // 3. 检查每日抽取次数（按秒级去重统计操作次数）
    const todayDrawCount = await getTodayDrawCount(connection, playerId, poolType);
    if (todayDrawCount >= DAILY_DRAW_LIMIT) {
      const label = poolType === 'troop' ? '部队' : '将领';
      throw new Error(`今日${label}卡池抽取次数已用完（${DAILY_DRAW_LIMIT}/${DAILY_DRAW_LIMIT}）`);
    }

    // 4. 获取今日已获得的稀有度统计
    const todayRarityCounts = await getTodayRarityCounts(connection, playerId, poolType);

    // 5. 获取保底计数（最新一条记录的 pity_count）
    const pityCount = await getPityCount(connection, playerId, poolType);

    // 6. 扣除银两
    await connection.query(
      'UPDATE players SET silver = silver - ? WHERE player_id = ?',
      [DRAW_COST, playerId]
    );

    // 7. 执行抽取
    const cardsPerDraw = poolType === 'troop' ? 2 : 1;
    const results = [];
    let runningPity = pityCount;

    for (let i = 0; i < cardsPerDraw; i++) {
      const result = await drawSingleCard(
        connection, playerId, poolType, player.faction_id,
        runningPity, todayRarityCounts, results
      );

      // 计算本张卡后的 pity_count
      if (result.rarity === 'legendary' && !result.compensated) {
        runningPity = 0;
      } else {
        runningPity += 1;
      }
      result.pityCount = runningPity;

      // 写入记录
      const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);
      await connection.query(
        `INSERT INTO temp_card_pool_draws 
         (player_id, pool_type, rarity, card_id, compensated, pity_count, drawn_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [playerId, poolType, result.rarity, result.cardId, result.compensated ? 1 : 0, runningPity, expiresAt]
      );

      results.push(result);

      // 更新今日稀有度计数（同一次抽取内第二张卡判断用）
      if (!result.compensated) {
        todayRarityCounts[result.rarity] = (todayRarityCounts[result.rarity] || 0) + 1;
      }
    }

    await connection.commit();

    // 查询更新后的银两
    const [updatedPlayer] = await connection.query(
      'SELECT silver FROM players WHERE player_id = ?', [playerId]
    );

    return {
      success: true,
      poolType,
      cost: DRAW_COST,
      remainingSilver: updatedPlayer[0].silver,
      remainingDraws: DAILY_DRAW_LIMIT - todayDrawCount - 1,
      cards: results,
      pityCount: runningPity,
    };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 抽取单张卡牌（不写入记录，由调用方统一写入）
 */
async function drawSingleCard(connection, playerId, poolType, factionId, currentPity, todayRarityCounts, previousResults) {
  const { season, factionNumber } = parseFactionId(factionId);

  // 决定稀有度
  let rarity = rollRarity();

  // 保底：达到阈值强制legendary
  if (currentPity >= PITY_THRESHOLD - 1) {
    rarity = 'legendary';
  }

  // 每日上限降级
  if (rarity === 'legendary' && (todayRarityCounts.legendary || 0) >= DAILY_RARITY_CAP.legendary) {
    rarity = 'epic';
  }
  if (rarity === 'epic' && (todayRarityCounts.epic || 0) >= DAILY_RARITY_CAP.epic) {
    rarity = 'rare';
  }

  // 从config表随机选卡（本势力 + 通用势力0）
  const table = poolType === 'troop' ? 'config_troops' : 'config_characters';
  const idField = poolType === 'troop' ? 'troop_id' : 'character_id';
  const nameField = poolType === 'troop' ? 'troop_name' : 'character_name';
  const idPrefix = poolType === 'troop' ? 'troop' : 'char';

  const excludeIds = previousResults.filter(r => r.cardId).map(r => r.cardId);
  const excludeClause = excludeIds.length > 0
    ? ` AND ${idField} NOT IN (${excludeIds.map(() => '?').join(',')})`
    : '';

  const query = `SELECT ${idField} AS card_id, ${nameField} AS card_name, rarity
    FROM ${table}
    WHERE rarity = ? AND (${idField} LIKE ? OR ${idField} LIKE ?)${excludeClause}
    ORDER BY RAND() LIMIT 1`;
  const params = [
    rarity,
    `${season}_${idPrefix}_${factionNumber}%`,
    `${season}_${idPrefix}_0%`,
    ...excludeIds,
  ];

  const [rows] = await connection.query(query, params);

  if (rows.length === 0) {
    return { rarity, cardId: null, cardName: null, compensated: true, compensation: { type: 'silver', amount: 20 }, reason: 'no_card_available' };
  }

  const card = rows[0];

  // ── 部队卡：检查持有上限 ──
  if (poolType === 'troop') {
    const limit = TROOP_LIMIT_BY_RARITY[rarity] || 20;
    const [countRows] = await connection.query(
      "SELECT COUNT(*) AS cnt FROM player_cards WHERE player_id = ? AND card_type = 'troop' AND rarity = ?",
      [playerId, rarity]
    );
    if (countRows[0].cnt >= limit) {
      const comp = TROOP_OVER_LIMIT_COMPENSATION[rarity] || 100;
      await connection.query('UPDATE players SET food = food + ? WHERE player_id = ?', [comp, playerId]);
      return { rarity, cardId: card.card_id, cardName: card.card_name, compensated: true, compensation: { type: 'food', amount: comp }, reason: 'troop_limit' };
    }

    // 插入部队卡实例
    const instanceId = `${card.card_id}_${playerId}_${Date.now()}`;
    const [troopConfig] = await connection.query(`SELECT max_troops FROM ${table} WHERE ${idField} = ?`, [card.card_id]);
    const maxTroops = troopConfig[0]?.max_troops || 200;

    await connection.query(
      `INSERT INTO player_cards (instance_id, player_id, card_type, card_id, rarity, current_troops, battle_count, max_battle_count, obtained_at)
       VALUES (?, ?, 'troop', ?, ?, ?, 0, ?, NOW())`,
      [instanceId, playerId, card.card_id, rarity, maxTroops, MAX_BATTLE_COUNT[rarity] || 20]
    );

    return { rarity, cardId: card.card_id, cardName: card.card_name, instanceId, compensated: false };
  }

  // ── 将领卡：检查唯一性 ──
  if (poolType === 'character') {
    const [existing] = await connection.query(
      "SELECT instance_id FROM player_cards WHERE player_id = ? AND card_id = ? AND card_type = 'character'",
      [playerId, card.card_id]
    );
    if (existing.length > 0) {
      const comp = CHARACTER_DUPLICATE_COMPENSATION[rarity] || 20;
      await connection.query('UPDATE players SET silver = silver + ? WHERE player_id = ?', [comp, playerId]);
      return { rarity, cardId: card.card_id, cardName: card.card_name, compensated: true, compensation: { type: 'silver', amount: comp }, reason: 'character_duplicate' };
    }

    const instanceId = `${card.card_id}_${playerId}_${Date.now()}`;
    // 查询将领的trait_modifier计算初始士气
    const [charConfig] = await connection.query(
      `SELECT trait_modifier FROM config_characters WHERE character_id = ?`, [card.card_id]
    );
    const traitMod = charConfig[0]?.trait_modifier ?? 0;
    const initialMorale = 70 + traitMod;

    await connection.query(
      `INSERT INTO player_cards (instance_id, player_id, card_type, card_id, rarity, morale, obtained_at)
       VALUES (?, ?, 'character', ?, ?, ?, NOW())`,
      [instanceId, playerId, card.card_id, rarity, initialMorale]
    );

    return { rarity, cardId: card.card_id, cardName: card.card_name, instanceId, compensated: false };
  }

  return { rarity, cardId: null, compensated: true, reason: 'unknown_pool' };
}

// ── 半天周期工具函数 ─────────────────────────────────────────

/**
 * 获取当前半天周期的起始时间SQL表达式
 * 00:00~11:59 → 今天00:00:00
 * 12:00~23:59 → 今天12:00:00
 * 每个周期独立5次额度，每天共10次/卡池
 */
const HALF_DAY_START_SQL = `IF(HOUR(NOW()) >= 12, CONCAT(CURDATE(), ' 12:00:00'), CONCAT(CURDATE(), ' 00:00:00'))`;

// ── 辅助查询函数 ─────────────────────────────────────────────

/**
 * 获取当前半天周期的抽取操作次数（部队池一次操作=2条记录，按秒级去重）
 */
async function getTodayDrawCount(connection, playerId, poolType) {
  const [rows] = await connection.query(
    `SELECT COUNT(DISTINCT DATE_FORMAT(drawn_at, '%Y-%m-%d %H:%i:%s')) AS cnt
     FROM temp_card_pool_draws
     WHERE player_id = ? AND pool_type = ? AND drawn_at >= ${HALF_DAY_START_SQL}`,
    [playerId, poolType]
  );
  return rows[0].cnt;
}

/**
 * 获取今日（全天）各稀有度实际获取数量（不含补偿）
 * 稀有度上限全天共享：传奇1张/天、史诗2张/天
 */
async function getTodayRarityCounts(connection, playerId, poolType) {
  const [rows] = await connection.query(
    `SELECT rarity, COUNT(*) AS cnt FROM temp_card_pool_draws
     WHERE player_id = ? AND pool_type = ? AND DATE(drawn_at) = CURDATE() AND compensated = FALSE
     GROUP BY rarity`,
    [playerId, poolType]
  );
  const counts = {};
  rows.forEach(r => { counts[r.rarity] = r.cnt; });
  return counts;
}

/**
 * 获取保底计数（最新一条记录的 pity_count）
 */
async function getPityCount(connection, playerId, poolType) {
  const [rows] = await connection.query(
    `SELECT pity_count FROM temp_card_pool_draws
     WHERE player_id = ? AND pool_type = ?
     ORDER BY id DESC LIMIT 1`,
    [playerId, poolType]
  );
  return rows.length > 0 ? rows[0].pity_count : 0;
}

// ── 查询接口 ─────────────────────────────────────────────────

/**
 * 获取卡池状态（剩余次数、保底进度等）
 */
async function getPoolStatus(playerId) {
  const [playerRows] = await pool.query(
    'SELECT silver, faction_id FROM players WHERE player_id = ?', [playerId]
  );
  if (playerRows.length === 0) throw new Error('玩家不存在');

  // 当前半天周期抽取次数
  const [troopCount] = await pool.query(
    `SELECT COUNT(DISTINCT DATE_FORMAT(drawn_at, '%Y-%m-%d %H:%i:%s')) AS cnt
     FROM temp_card_pool_draws WHERE player_id = ? AND pool_type = 'troop' AND drawn_at >= ${HALF_DAY_START_SQL}`,
    [playerId]
  );
  const [charCount] = await pool.query(
    `SELECT COUNT(DISTINCT DATE_FORMAT(drawn_at, '%Y-%m-%d %H:%i:%s')) AS cnt
     FROM temp_card_pool_draws WHERE player_id = ? AND pool_type = 'character' AND drawn_at >= ${HALF_DAY_START_SQL}`,
    [playerId]
  );

  // 保底计数
  const [troopPity] = await pool.query(
    `SELECT pity_count FROM temp_card_pool_draws WHERE player_id = ? AND pool_type = 'troop' ORDER BY id DESC LIMIT 1`,
    [playerId]
  );
  const [charPity] = await pool.query(
    `SELECT pity_count FROM temp_card_pool_draws WHERE player_id = ? AND pool_type = 'character' ORDER BY id DESC LIMIT 1`,
    [playerId]
  );

  return {
    silver: playerRows[0].silver,
    drawCost: DRAW_COST,
    troop: {
      remainingDraws: Math.max(0, DAILY_DRAW_LIMIT - troopCount[0].cnt),
      dailyLimit: DAILY_DRAW_LIMIT,
      cardsPerDraw: 2,
      pityCount: troopPity.length > 0 ? troopPity[0].pity_count : 0,
      pityThreshold: PITY_THRESHOLD,
    },
    character: {
      remainingDraws: Math.max(0, DAILY_DRAW_LIMIT - charCount[0].cnt),
      dailyLimit: DAILY_DRAW_LIMIT,
      cardsPerDraw: 1,
      pityCount: charPity.length > 0 ? charPity[0].pity_count : 0,
      pityThreshold: PITY_THRESHOLD,
    },
    probabilities: DRAW_PROBABILITIES,
  };
}

// ── 导出 ─────────────────────────────────────────────────────

module.exports = {
  drawFromPool,
  getPoolStatus,
  DRAW_PROBABILITIES,
  DAILY_DRAW_LIMIT,
  DRAW_COST,
  PITY_THRESHOLD,
};
