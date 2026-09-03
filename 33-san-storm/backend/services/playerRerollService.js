/**
 * 官职属性随机（reroll）：状态查询、执行随机、确认方案、大司空卸职自动重随
 */

const { pool } = require('../database/connection');
const PlayerService = require('./playerService');
const statisticsDeltaService = require('./statisticsDeltaService');
const factionReserveService = require('./factionReserveService');
const { getRerollRarityForPlayer } = require('../../shared/utils/positionRerollRarity.cjs');

const REROLL_COST = { common: 10, rare: 50, epic: 250, legendary: 500, core: 750 };
const REROLL_DAILY_LIMIT = 2;

function extractAttrsFromOption(option) {
  const attrs = option.attributesInt || {};
  const toInt = (v) => Math.round((v || 0) * 10);
  return {
    luck: attrs.luck ?? toInt(option.attributes?.luck),
    courage: attrs.courage ?? toInt(option.attributes?.courage),
    combat: attrs.combat ?? toInt(option.attributes?.combat),
    command: attrs.command ?? toInt(option.attributes?.command),
    intelligence: attrs.intelligence ?? toInt(option.attributes?.intelligence),
    politics: attrs.politics ?? toInt(option.attributes?.politics),
    charm: attrs.charm ?? toInt(option.attributes?.charm),
    skill1: option.skills?.skill_1?.id || option.skills?.skill_1 || null,
    skill2: option.skills?.skill_2?.id || option.skills?.skill_2 || null,
  };
}

/**
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} db
 */
async function applyAttributeOption(db, playerId, option, opts = {}) {
  const { clearBatches = true } = opts;
  const a = extractAttrsFromOption(option);
  const sql = clearBatches
    ? `UPDATE players SET
         luck = ?, courage = ?, combat = ?, command = ?,
         intelligence = ?, politics = ?, charm = ?,
         skill_1 = ?, skill_2 = ?,
         attr_reroll_batches = NULL,
         attr_reroll_selected_batch = NULL,
         attr_reroll_selected_index = NULL
       WHERE player_id = ?`
    : `UPDATE players SET
         luck = ?, courage = ?, combat = ?, command = ?,
         intelligence = ?, politics = ?, charm = ?,
         skill_1 = ?, skill_2 = ?
       WHERE player_id = ?`;
  await db.query(sql, [
    a.luck,
    a.courage,
    a.combat,
    a.command,
    a.intelligence,
    a.politics,
    a.charm,
    a.skill1,
    a.skill2,
    playerId,
  ]);
  return {
    attributes: option.attributes,
    skills: option.skills,
    type: option.type,
  };
}

/**
 * 服务端自动重随（不扣银、不占日限）：卸大司空等系统回退时调用
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function autoRerollAttributesForRarity(connection, playerId, rarity) {
  const options = await PlayerService.generateAttributeOptions(rarity);
  const index = Math.floor(Math.random() * options.length);
  const option = options[index];
  const applied = await applyAttributeOption(connection, playerId, option, { clearBatches: true });
  return { rarity, index, ...applied };
}

async function getRerollStatus(playerId) {
  const [rows] = await pool.query(
    `SELECT position_level, current_position_id, silver,
            IF(attr_reroll_date = CURDATE(), attr_reroll_count, 0) AS today_used,
            attr_reroll_batches,
            attr_reroll_selected_batch, attr_reroll_selected_index
     FROM players WHERE player_id = ?`,
    [playerId]
  );
  if (!rows.length) return { notFound: true };
  const p = rows[0];
  const rarity = getRerollRarityForPlayer({
    positionLevel: p.position_level,
    currentPositionId: p.current_position_id,
  });
  const cost = REROLL_COST[rarity];
  const remaining = REROLL_DAILY_LIMIT - (p.today_used || 0);
  const batches = p.attr_reroll_batches
    ? typeof p.attr_reroll_batches === 'string'
      ? JSON.parse(p.attr_reroll_batches)
      : p.attr_reroll_batches
    : [];
  return {
    notFound: false,
    data: {
      rarity,
      cost,
      dailyLimit: REROLL_DAILY_LIMIT,
      remaining,
      silver: p.silver,
      batches,
      selectedBatch: p.attr_reroll_selected_batch,
      selectedIndex: p.attr_reroll_selected_index,
    },
  };
}

async function rerollAttributes(playerId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT position_level, current_position_id, silver, faction_id,
              IF(attr_reroll_date = CURDATE(), attr_reroll_count, 0) AS today_used,
              attr_reroll_batches
       FROM players WHERE player_id = ? FOR UPDATE`,
      [playerId],
    );
    if (!rows.length) {
      await conn.rollback();
      return { notFound: true };
    }
    const p = rows[0];
    const rarity = getRerollRarityForPlayer({
      positionLevel: p.position_level,
      currentPositionId: p.current_position_id,
    });
    const cost = REROLL_COST[rarity];
    const remaining = REROLL_DAILY_LIMIT - (p.today_used || 0);

    if (remaining <= 0) {
      await conn.rollback();
      return { badRequest: '今日属性随机次数已用完（上限2次/天）' };
    }
    if (p.silver < cost) {
      await conn.rollback();
      return { badRequest: `银两不足，需要${cost}银两` };
    }

    const options = await PlayerService.generateAttributeOptions(rarity);

    const batches = p.attr_reroll_batches
      ? typeof p.attr_reroll_batches === 'string'
        ? JSON.parse(p.attr_reroll_batches)
        : p.attr_reroll_batches
      : [];
    const newBatch = {
      batch: batches.length + 1,
      timestamp: new Date().toISOString(),
      cost,
      rarity,
      options,
    };
    batches.push(newBatch);

    const newUsed = (p.today_used || 0) + 1;
    const newRemaining = REROLL_DAILY_LIMIT - newUsed;
    await conn.query(
      `UPDATE players SET
        silver = silver - ?,
        attr_reroll_date = CURDATE(),
        attr_reroll_count = ?,
        attr_reroll_batches = ?,
        attr_reroll_selected_batch = NULL,
        attr_reroll_selected_index = NULL
       WHERE player_id = ?`,
      [cost, newUsed, JSON.stringify(batches), playerId],
    );

    const factionId = String(p.faction_id || '').trim();
    if (factionId) {
      await factionReserveService.ensurePoolRow(conn, factionId);
      await factionReserveService.creditPoolOnConnection(conn, factionId, { silver: cost }, {
        ledgerCategory: factionReserveService.CATEGORY.ATTR_REROLL,
      });
    }

    await conn.commit();

    await statisticsDeltaService.incrementSpent(playerId, { silver: cost });

    return {
      ok: true,
      data: {
        batch: newBatch.batch,
        options,
        cost,
        remainingSilver: p.silver - cost,
        remaining: newRemaining,
        batches,
      },
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function rerollConfirm(playerId, batch, index) {
  if (batch == null || index == null) {
    return { badRequest: '缺少 batch 或 index' };
  }

  const [rows] = await pool.query('SELECT attr_reroll_batches FROM players WHERE player_id = ?', [
    playerId,
  ]);
  if (!rows.length) return { notFound: true };

  const batches = rows[0].attr_reroll_batches
    ? typeof rows[0].attr_reroll_batches === 'string'
      ? JSON.parse(rows[0].attr_reroll_batches)
      : rows[0].attr_reroll_batches
    : [];
  const targetBatch = batches.find((b) => b.batch === batch);
  if (!targetBatch) return { badRequest: `批次 ${batch} 不存在` };
  if (index < 0 || index >= targetBatch.options.length) {
    return { badRequest: `索引 ${index} 超出范围` };
  }

  const option = targetBatch.options[index];
  const applied = await applyAttributeOption(pool, playerId, option, { clearBatches: true });

  await pool.query(
    `UPDATE players SET attr_reroll_selected_batch = ?, attr_reroll_selected_index = ? WHERE player_id = ?`,
    [batch, index, playerId]
  );

  return {
    ok: true,
    data: {
      ...applied,
      selectedBatch: batch,
      selectedIndex: index,
    },
  };
}

module.exports = {
  getRerollStatus,
  rerollAttributes,
  rerollConfirm,
  autoRerollAttributesForRarity,
  applyAttributeOption,
  REROLL_COST,
  REROLL_DAILY_LIMIT,
};
