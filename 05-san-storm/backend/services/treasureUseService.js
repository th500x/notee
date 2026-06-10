/**
 * 宝物战后扣次与耗尽清理
 * @see docs/20-data-layer/26-1-TREASURE_SYSTEM.md §6.3
 */

const { getInitialUsesRemaining } = require('../../shared/utils/treasureUses.cjs');

const GARRISON_TREASURE_FIELDS = ['char1_treasure', 'char2_treasure'];

async function queryFnAdapter(queryFn, sql, params) {
  const result = await queryFn(sql, params);
  return Array.isArray(result) ? result : [result];
}

async function clearGarrisonTreasureRefs(queryFn, playerId, instanceId) {
  const sets = GARRISON_TREASURE_FIELDS.map((f) => `${f} = CASE WHEN ${f} = ? THEN NULL ELSE ${f} END`).join(', ');
  await queryFnAdapter(
    queryFn,
    `UPDATE player_garrison SET ${sets} WHERE player_id = ?`,
    [instanceId, playerId],
  );
}

async function deleteDepletedTreasure(queryFn, playerId, instanceId) {
  await queryFnAdapter(
    queryFn,
    `UPDATE player_cards SET is_equipped = FALSE, equipped_by = NULL, equipped_slot = NULL
     WHERE instance_id = ? AND player_id = ?`,
    [instanceId, playerId],
  );
  await clearGarrisonTreasureRefs(queryFn, playerId, instanceId);
  await queryFnAdapter(
    queryFn,
    'DELETE FROM player_cards WHERE instance_id = ? AND player_id = ? AND card_type = ?',
    [instanceId, playerId, 'treasure'],
  );
}

async function consumeTreasureInstances(queryFn, playerId, instanceIds) {
  const uniq = [...new Set((instanceIds || []).filter(Boolean))];
  if (uniq.length === 0) return;

  const ph = uniq.map(() => '?').join(',');
  const [rows] = await queryFnAdapter(
    queryFn,
    `SELECT instance_id, card_id, uses_remaining
     FROM player_cards
     WHERE player_id = ? AND card_type = 'treasure' AND instance_id IN (${ph})`,
    [playerId, ...uniq],
  );

  for (const row of rows) {
    if (row.uses_remaining == null) continue;
    const next = Number(row.uses_remaining) - 1;
    if (next <= 0) {
      await deleteDepletedTreasure(queryFn, playerId, row.instance_id);
      console.log(`[treasureUse] 宝物耗尽删除: player=${playerId} instance=${row.instance_id}`);
    } else {
      await queryFnAdapter(
        queryFn,
        'UPDATE player_cards SET uses_remaining = ? WHERE instance_id = ? AND player_id = ?',
        [next, row.instance_id, playerId],
      );
    }
  }
}

async function resolveEquippedByFromTroopIds(queryFn, playerId, troopInstanceIds) {
  const troopIds = [...new Set((troopInstanceIds || []).filter(Boolean))];
  if (troopIds.length === 0) return new Set();

  const ph = troopIds.map(() => '?').join(',');
  const [rows] = await queryFnAdapter(
    queryFn,
    `SELECT DISTINCT equipped_by FROM player_cards
     WHERE player_id = ? AND card_type = 'troop' AND instance_id IN (${ph}) AND equipped_by IS NOT NULL`,
    [playerId, ...troopIds],
  );
  return new Set(rows.map((r) => r.equipped_by).filter(Boolean));
}

async function resolveMainLineupTreasureInstanceIds(queryFn, playerId, troopInstanceIds) {
  const equippedBySet = await resolveEquippedByFromTroopIds(queryFn, playerId, troopInstanceIds);
  if (equippedBySet.size === 0) return [];

  const slots = [...equippedBySet];
  const ph = slots.map(() => '?').join(',');
  const [rows] = await queryFnAdapter(
    queryFn,
    `SELECT instance_id FROM player_cards
     WHERE player_id = ? AND card_type = 'treasure'
       AND is_equipped = TRUE AND equipped_slot = 'treasure'
       AND equipped_by IN (${ph})`,
    [playerId, ...slots],
  );
  return rows.map((r) => r.instance_id);
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
 * 参战部队结算后扣宝物次（上阵编组 + 可选驻地行）
 * @param {Function} queryFn - (sql, params) => pool.query / conn.query
 * @param {string} playerId
 * @param {string[]} troopInstanceIds - 本场参战部队 instance_id
 * @param {object|null} [garrisonRow] - player_garrison 行（snake_case）；驻地战传入
 */
async function consumeTreasuresAfterBattle(queryFn, playerId, troopInstanceIds, garrisonRow = null) {
  if (!playerId) return;
  const troopIds = [...new Set((troopInstanceIds || []).filter(Boolean))];
  if (troopIds.length === 0) return;

  const instanceIds = new Set();
  for (const id of await resolveMainLineupTreasureInstanceIds(queryFn, playerId, troopIds)) {
    instanceIds.add(id);
  }
  for (const id of resolveGarrisonTreasureInstanceIds(garrisonRow, troopIds)) {
    instanceIds.add(id);
  }

  if (instanceIds.size === 0) return;
  await consumeTreasureInstances(queryFn, playerId, [...instanceIds]);
}

module.exports = {
  getInitialUsesRemaining,
  consumeTreasuresAfterBattle,
  consumeTreasureInstances,
  resolveMainLineupTreasureInstanceIds,
  resolveGarrisonTreasureInstanceIds,
  deleteDepletedTreasure,
};
