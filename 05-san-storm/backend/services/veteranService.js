/**
 * 老兵系统服务
 *
 * 当 legendary / core 部队卡累计参战场次达到各档阈值时：
 * - legendary（橙）：固定 **120 / 240 / 360** 场（三档，不随 max_battle_count 缩放）
 * - core（金）：仍为 3M / 6M / 9M（M = max_battle_count）
 * 随机掷点永久加成全属性（1-3% 前两档，1-4% 第三档），总计 3%-10%。
 *
 * @module backend/services/veteranService
 */

const VETERAN_THRESHOLDS = [3, 6, 9];

/** legendary（橙）三档累计参战场次阈值（固定值，不随 max_battle_count 缩放） */
const LEGENDARY_VETERAN_LIFETIME_THRESHOLDS = [120, 240, 360];

const VETERAN_ROLL_RANGE = [
  { min: 1, max: 3 },
  { min: 1, max: 3 },
  { min: 1, max: 4 },
];

/**
 * 随机整数 [min, max]（含两端）
 */
function rollRandom(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * 检查指定玩家所有可晋升老兵的部队卡，执行晋升并写库。
 * 支持多档连跳（若累计场次跨越多个阈值）。
 *
 * @param {Function} query - (sql, params) => Promise（pool.query 或事务 conn.query）
 * @param {string} playerId
 * @returns {Promise<Array<{ instanceId: string, cardId: string, cardName: string, rarity: string, newTier: number, rollPct: number, totalPct: number }>>}
 */
async function checkAndApplyVeteran(query, playerId) {
  const [rows] = await query(
    `SELECT pc.instance_id, pc.card_id, pc.lifetime_battle_count,
            pc.max_battle_count, pc.veteran_tier, pc.veteran_bonus_pct,
            ct.troop_name
     FROM player_cards pc
     LEFT JOIN config_troops ct ON pc.card_id = ct.troop_id
     WHERE pc.player_id = ?
       AND pc.card_type = 'troop'
       AND pc.rarity IN ('legendary', 'core')
       AND pc.veteran_tier < 3`,
    [playerId],
  );

  const promotions = [];

  for (const row of rows) {
    let tier = row.veteran_tier || 0;
    let totalPct = Number(row.veteran_bonus_pct) || 0;
    const lifetime = row.lifetime_battle_count || 0;
    const maxBattle = row.max_battle_count || 60;
    let promoted = false;

    while (tier < 3) {
      const threshold =
        row.rarity === 'legendary'
          ? LEGENDARY_VETERAN_LIFETIME_THRESHOLDS[tier]
          : VETERAN_THRESHOLDS[tier] * maxBattle;
      if (lifetime < threshold) break;

      const range = VETERAN_ROLL_RANGE[tier];
      const roll = rollRandom(range.min, range.max);
      tier += 1;
      totalPct += roll;
      promoted = true;

      promotions.push({
        instanceId: row.instance_id,
        cardId: row.card_id,
        cardName: row.troop_name || row.card_id,
        rarity: row.rarity,
        newTier: tier,
        rollPct: roll,
        totalPct,
      });
    }

    if (promoted) {
      await query(
        `UPDATE player_cards
         SET veteran_tier = ?, veteran_bonus_pct = ?
         WHERE instance_id = ? AND player_id = ?`,
        [tier, totalPct, row.instance_id, playerId],
      );
    }
  }

  return promotions;
}

module.exports = {
  VETERAN_THRESHOLDS,
  LEGENDARY_VETERAN_LIFETIME_THRESHOLDS,
  VETERAN_ROLL_RANGE,
  checkAndApplyVeteran,
};
