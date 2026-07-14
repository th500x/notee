/**
 * 宝物战后扣次与耗尽清理
 * @see docs/00/20-data-layer/26-1-TREASURE_SYSTEM.md §6.3
 *
 * 与 troopDurabilityService 对齐：参战部队 instance_id → 解析应扣次的宝物 → 扣次/删除 → 清驻地槽引用。
 */

const { getInitialUsesRemaining } = require('../../shared/utils/treasureUses.cjs');

const GARRISON_TREASURE_FIELDS = ['char1_treasure', 'char2_treasure'];

async function queryFnAdapter(queryFn, sql, params) {
  const result = await queryFn(sql, params);
  return Array.isArray(result) ? result : [result];
}

function affectedRows(header) {
  return header?.affectedRows ?? 0;
}

async function clearGarrisonTreasureRefs(queryFn, playerId, instanceId) {
  const sets = GARRISON_TREASURE_FIELDS.map((f) => `${f} = CASE WHEN ${f} = ? THEN NULL ELSE ${f} END`).join(', ');
  const params = [...GARRISON_TREASURE_FIELDS.map(() => instanceId), playerId];
  await queryFnAdapter(
    queryFn,
    `UPDATE player_lineup_sets SET ${sets} WHERE player_id = ?`,
    params,
  );
}

/**
 * 与 clearExhaustedOrMissingTroopsFromGarrison 对称：实例已删或 uses<=0 时清 char*_treasure。
 */
async function clearDepletedOrMissingTreasuresFromGarrison(queryFn, playerId) {
  await queryFnAdapter(
    queryFn,
    `UPDATE player_lineup_sets g
     LEFT JOIN player_cards pc1 ON pc1.instance_id = g.char1_treasure AND pc1.player_id = g.player_id
     LEFT JOIN player_cards pc2 ON pc2.instance_id = g.char2_treasure AND pc2.player_id = g.player_id
     SET
       g.char1_treasure = IF(
         g.char1_treasure IS NOT NULL AND (
           pc1.instance_id IS NULL OR (
             pc1.card_type = 'treasure'
             AND pc1.uses_remaining IS NOT NULL
             AND pc1.uses_remaining <= 0
           )
         ), NULL, g.char1_treasure),
       g.char2_treasure = IF(
         g.char2_treasure IS NOT NULL AND (
           pc2.instance_id IS NULL OR (
             pc2.card_type = 'treasure'
             AND pc2.uses_remaining IS NOT NULL
             AND pc2.uses_remaining <= 0
           )
         ), NULL, g.char2_treasure)
     WHERE g.player_id = ?`,
    [playerId],
  );
}

async function deleteDepletedTreasure(queryFn, playerId, instanceId) {
  await clearGarrisonTreasureRefs(queryFn, playerId, instanceId);
  await queryFnAdapter(
    queryFn,
    `UPDATE player_cards SET is_equipped = FALSE, equipped_by = NULL, equipped_slot = NULL, uses_remaining = 0
     WHERE instance_id = ? AND player_id = ? AND card_type = 'treasure'`,
    [instanceId, playerId],
  );
  const [del] = await queryFnAdapter(
    queryFn,
    'DELETE FROM player_cards WHERE instance_id = ? AND player_id = ? AND card_type = ?',
    [instanceId, playerId, 'treasure'],
  );
  if (affectedRows(del) === 0) {
    console.error(`[treasureUse] 宝物耗尽后删除失败: player=${playerId} instance=${instanceId}`);
    throw new Error(`Treasure delete failed: ${instanceId}`);
  }
  console.log(`[treasureUse] 宝物耗尽删除: player=${playerId} instance=${instanceId}`);
}

async function consumeOneTreasureInstance(queryFn, playerId, instanceId) {
  const [upd] = await queryFnAdapter(
    queryFn,
    `UPDATE player_cards
     SET uses_remaining = uses_remaining - 1
     WHERE instance_id = ? AND player_id = ? AND card_type = 'treasure'
       AND uses_remaining IS NOT NULL AND uses_remaining > 0`,
    [instanceId, playerId],
  );
  if (affectedRows(upd) === 0) return;

  const [rows] = await queryFnAdapter(
    queryFn,
    `SELECT uses_remaining FROM player_cards
     WHERE instance_id = ? AND player_id = ? AND card_type = 'treasure'`,
    [instanceId, playerId],
  );
  const rem = rows[0]?.uses_remaining;
  if (rem != null && Number(rem) <= 0) {
    await deleteDepletedTreasure(queryFn, playerId, instanceId);
  }
}

async function consumeTreasureInstances(queryFn, playerId, instanceIds) {
  const uniq = [...new Set((instanceIds || []).filter(Boolean))];
  for (const instanceId of uniq) {
    await consumeOneTreasureInstance(queryFn, playerId, instanceId);
  }
}

/**
 * 清理 uses_remaining 已归零但仍残留在库中的宝物（历史 partial 失败兜底）
 */
async function purgeZeroUsesTreasureCards(queryFn, playerId) {
  if (!playerId) return 0;
  const [rows] = await queryFnAdapter(
    queryFn,
    `SELECT instance_id FROM player_cards
     WHERE player_id = ? AND card_type = 'treasure'
       AND uses_remaining IS NOT NULL AND uses_remaining <= 0`,
    [playerId],
  );
  let purged = 0;
  for (const row of rows) {
    try {
      await deleteDepletedTreasure(queryFn, playerId, row.instance_id);
      purged += 1;
    } catch (err) {
      console.error(`[treasureUse] purgeZeroUses 失败: player=${playerId} instance=${row.instance_id}`, err);
    }
  }
  return purged;
}

/**
 * 上阵编组：参战部队 equipped_by 与宝物 equipped_by 对齐（单条 SQL，避免两步漏匹配）
 */
async function resolveMainLineupTreasureInstanceIds(queryFn, playerId, troopInstanceIds) {
  const troopIds = [...new Set((troopInstanceIds || []).filter(Boolean))];
  if (troopIds.length === 0) return [];

  const ph = troopIds.map(() => '?').join(',');
  const [rows] = await queryFnAdapter(
    queryFn,
    `SELECT DISTINCT t.instance_id
     FROM player_cards pc_troop
     INNER JOIN player_cards t
       ON t.player_id = pc_troop.player_id
       AND t.card_type = 'treasure'
       AND t.is_equipped = TRUE
       AND t.equipped_slot = 'treasure'
       AND t.equipped_by = pc_troop.equipped_by
     WHERE pc_troop.player_id = ?
       AND pc_troop.card_type = 'troop'
       AND pc_troop.instance_id IN (${ph})
       AND pc_troop.equipped_by IS NOT NULL
       AND t.uses_remaining IS NOT NULL`,
    [playerId, ...troopIds],
  );
  return rows.map((r) => r.instance_id);
}

/**
 * 驻地编组：凡 char*_troop* 在本场参战集合内，则扣对应 char*_treasure（不依赖 is_equipped）
 */
async function resolveGarrisonTreasureInstanceIdsFromDb(queryFn, playerId, troopInstanceIds) {
  const troopIds = [...new Set((troopInstanceIds || []).filter(Boolean))];
  if (troopIds.length === 0) return [];

  const [rows] = await queryFnAdapter(
    queryFn,
    `SELECT char1_treasure, char2_treasure, char1_troop1, char1_troop2, char2_troop1, char2_troop2
     FROM player_lineup_sets WHERE player_id = ?`,
    [playerId],
  );
  const troopSet = new Set(troopIds);
  const out = new Set();
  for (const row of rows) {
    for (const charKey of ['char1', 'char2']) {
      const troopFields = [`${charKey}_troop1`, `${charKey}_troop2`];
      const participated = troopFields.some((f) => row[f] && troopSet.has(row[f]));
      const treasureId = row[`${charKey}_treasure`];
      if (participated && treasureId) out.add(treasureId);
    }
  }
  return [...out];
}

function resolveGarrisonTreasureInstanceIds(garrisonRow, troopInstanceIds) {
  if (!garrisonRow) return [];
  const troopSet = new Set((troopInstanceIds || []).filter(Boolean));
  if (troopSet.size === 0) return [];

  const out = [];
  for (const charKey of ['char1', 'char2']) {
    const troopFields = [`${charKey}_troop1`, `${charKey}_troop2`];
    const participated = troopFields.some((f) => garrisonRow[f] && troopSet.has(garrisonRow[f]));
    const treasureId = garrisonRow[`${charKey}_treasure`];
    if (participated && treasureId) out.push(treasureId);
  }
  return out;
}

/**
 * 参战部队结算后扣宝物次（上阵编组 + 全部驻地行）
 * @param {Function} queryFn - (sql, params) => pool.query / conn.query
 * @param {string} playerId
 * @param {string[]} troopInstanceIds - 本场参战部队 instance_id
 * @param {object|null} [garrisonRow] - 可选：同事务内刚读到的单行（与 DB 全表扫描结果合并）
 */
async function consumeTreasuresAfterBattle(queryFn, playerId, troopInstanceIds, garrisonRow = null) {
  if (!playerId) return;
  const troopIds = [...new Set((troopInstanceIds || []).filter(Boolean))];
  if (troopIds.length === 0) return;

  const instanceIds = new Set();
  for (const id of await resolveMainLineupTreasureInstanceIds(queryFn, playerId, troopIds)) {
    instanceIds.add(id);
  }
  for (const id of await resolveGarrisonTreasureInstanceIdsFromDb(queryFn, playerId, troopIds)) {
    instanceIds.add(id);
  }
  for (const id of resolveGarrisonTreasureInstanceIds(garrisonRow, troopIds)) {
    instanceIds.add(id);
  }

  if (instanceIds.size > 0) {
    await consumeTreasureInstances(queryFn, playerId, [...instanceIds]);
  }
  await purgeZeroUsesTreasureCards(queryFn, playerId);
  await clearDepletedOrMissingTreasuresFromGarrison(queryFn, playerId);
  const { syncTroopEffectBonusesForPlayer } = require('./playerCardLineupService');
  await syncTroopEffectBonusesForPlayer({ query: queryFn }, playerId);
}

module.exports = {
  getInitialUsesRemaining,
  consumeTreasuresAfterBattle,
  consumeTreasureInstances,
  resolveMainLineupTreasureInstanceIds,
  resolveGarrisonTreasureInstanceIds,
  resolveGarrisonTreasureInstanceIdsFromDb,
  deleteDepletedTreasure,
  purgeZeroUsesTreasureCards,
  clearDepletedOrMissingTreasuresFromGarrison,
};
