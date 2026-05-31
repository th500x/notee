/**
 * 老兵系统服务
 *
 * 当 legendary / core 部队卡累计参战场次达到各档阈值时：
 * - legendary（橙）：固定 **120 / 240 / 360** 场
 * - core（金）：固定 **180 / 360 / 540** 场
 * 随机掷点永久加成全属性（1-3% 前两档，1-4% 第三档），总计 3%-10%。
 *
 * @module backend/services/veteranService
 */

const {
  CORE_VETERAN_LIFETIME_THRESHOLDS,
  LEGENDARY_VETERAN_LIFETIME_THRESHOLDS,
} = require('../../shared/utils/troopVeteranDisplay.cjs');

const VETERAN_ROLL_RANGE = [
  { min: 1, max: 3 },
  { min: 1, max: 3 },
  { min: 1, max: 4 },
];

function rollRandom(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function normalizeInstanceIds(instanceIds) {
  if (!Array.isArray(instanceIds)) return [];
  return [...new Set(instanceIds.map((id) => String(id).trim()).filter(Boolean))];
}

/**
 * @param {Function} query
 * @param {string} playerId
 * @param {{ instanceIds?: string[] }} [options]
 */
async function checkAndApplyVeteran(query, playerId, options = {}) {
  const participantIds = normalizeInstanceIds(options.instanceIds);
  if (participantIds.length === 0) return [];

  const placeholders = participantIds.map(() => '?').join(',');
  const [rows] = await query(
    `SELECT pc.instance_id, pc.card_id, pc.lifetime_battle_count,
            pc.veteran_tier, pc.veteran_bonus_pct,
            ct.troop_name,
            COALESCE(ct.rarity, pc.rarity) AS effective_rarity
     FROM player_cards pc
     LEFT JOIN config_troops ct ON pc.card_id = ct.troop_id
     WHERE pc.player_id = ?
       AND pc.card_type = 'troop'
       AND pc.instance_id IN (${placeholders})
       AND COALESCE(ct.rarity, pc.rarity) IN ('legendary', 'core')
       AND pc.veteran_tier < 3`,
    [playerId, ...participantIds],
  );

  const promotions = [];

  for (const row of rows) {
    let tier = row.veteran_tier || 0;
    let totalPct = Number(row.veteran_bonus_pct) || 0;
    const lifetime = row.lifetime_battle_count || 0;
    const effectiveRarity = row.effective_rarity;

    if (tier >= 3) continue;

    const thresholds =
      effectiveRarity === 'legendary'
        ? LEGENDARY_VETERAN_LIFETIME_THRESHOLDS
        : CORE_VETERAN_LIFETIME_THRESHOLDS;
    const threshold = thresholds[tier];
    if (threshold == null || lifetime < threshold) continue;

    const range = VETERAN_ROLL_RANGE[tier];
    const roll = rollRandom(range.min, range.max);
    tier += 1;
    totalPct += roll;

    await query(
      `UPDATE player_cards
       SET veteran_tier = ?, veteran_bonus_pct = ?
       WHERE instance_id = ? AND player_id = ?`,
      [tier, totalPct, row.instance_id, playerId],
    );

    promotions.push({
      instanceId: row.instance_id,
      cardId: row.card_id,
      cardName: row.troop_name || row.card_id,
      rarity: effectiveRarity,
      newTier: tier,
      rollPct: roll,
      totalPct,
    });
  }

  return promotions;
}

module.exports = {
  CORE_VETERAN_LIFETIME_THRESHOLDS,
  LEGENDARY_VETERAN_LIFETIME_THRESHOLDS,
  VETERAN_ROLL_RANGE,
  checkAndApplyVeteran,
  normalizeInstanceIds,
};
