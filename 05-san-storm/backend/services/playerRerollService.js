/**
 * 官职属性随机（reroll）：状态查询、执行随机、确认方案
 */

const { pool } = require('../database/connection');
const PlayerService = require('./playerService');

const REROLL_COST = { common: 10, rare: 50, epic: 250, legendary: 500, core: 750 };
const REROLL_DAILY_LIMIT = 2;

function getPositionRarity(positionLevel) {
  if (positionLevel <= 3) return 'core';
  if (positionLevel === 4) return 'legendary';
  if (positionLevel === 5) return 'epic';
  if (positionLevel <= 7) return 'rare';
  return 'common';
}

async function getRerollStatus(playerId) {
  const [rows] = await pool.query(
    `SELECT position_level, silver,
            IF(attr_reroll_date = CURDATE(), attr_reroll_count, 0) AS today_used,
            attr_reroll_batches,
            attr_reroll_selected_batch, attr_reroll_selected_index
     FROM players WHERE player_id = ?`,
    [playerId]
  );
  if (!rows.length) return { notFound: true };
  const p = rows[0];
  const rarity = getPositionRarity(p.position_level ?? 8);
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
  const [rows] = await pool.query(
    `SELECT position_level, silver,
            IF(attr_reroll_date = CURDATE(), attr_reroll_count, 0) AS today_used,
            attr_reroll_batches
     FROM players WHERE player_id = ?`,
    [playerId]
  );
  if (!rows.length) return { notFound: true };
  const p = rows[0];
  const rarity = getPositionRarity(p.position_level ?? 8);
  const cost = REROLL_COST[rarity];
  const remaining = REROLL_DAILY_LIMIT - (p.today_used || 0);

  if (remaining <= 0) {
    return { badRequest: '今日属性随机次数已用完（上限2次/天）' };
  }
  if (p.silver < cost) {
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
  await pool.query(
    `UPDATE players SET
      silver = silver - ?,
      attr_reroll_date = CURDATE(),
      attr_reroll_count = ?,
      attr_reroll_batches = ?,
      attr_reroll_selected_batch = NULL,
      attr_reroll_selected_index = NULL
     WHERE player_id = ?`,
    [cost, newUsed, JSON.stringify(batches), playerId]
  );

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
  const attrs = option.attributesInt || {};
  const toInt = (v) => Math.round((v || 0) * 10);
  const luck = attrs.luck ?? toInt(option.attributes?.luck);
  const courage = attrs.courage ?? toInt(option.attributes?.courage);
  const combat = attrs.combat ?? toInt(option.attributes?.combat);
  const command = attrs.command ?? toInt(option.attributes?.command);
  const intelligence = attrs.intelligence ?? toInt(option.attributes?.intelligence);
  const politics = attrs.politics ?? toInt(option.attributes?.politics);
  const charm = attrs.charm ?? toInt(option.attributes?.charm);
  const skill1 = option.skills?.skill_1?.id || option.skills?.skill_1 || null;
  const skill2 = option.skills?.skill_2?.id || option.skills?.skill_2 || null;

  await pool.query(
    `UPDATE players SET
      luck = ?, courage = ?, combat = ?, command = ?,
      intelligence = ?, politics = ?, charm = ?,
      skill_1 = ?, skill_2 = ?,
      attr_reroll_batches = NULL,
      attr_reroll_selected_batch = ?,
      attr_reroll_selected_index = ?
     WHERE player_id = ?`,
    [
      luck,
      courage,
      combat,
      command,
      intelligence,
      politics,
      charm,
      skill1,
      skill2,
      batch,
      index,
      playerId,
    ]
  );

  return {
    ok: true,
    data: {
      attributes: option.attributes,
      skills: option.skills,
      type: option.type,
      selectedBatch: batch,
      selectedIndex: index,
    },
  };
}

module.exports = {
  getRerollStatus,
  rerollAttributes,
  rerollConfirm,
  REROLL_COST,
  REROLL_DAILY_LIMIT,
};
