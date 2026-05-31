/**
 * 老兵系统服务
 *
 * 当 legendary / core 部队卡累计参战场次达到各档阈值时：
 * - legendary（橙）：固定 **120 / 240 / 360** 场（三档，不随 max_battle_count 缩放）
 * - core（金）：**3 / 6 / 9 × max_battle_count** 场（M 通常 60 → **180 / 360 / 540**）
 * 随机掷点永久加成全属性（1-3% 前两档，1-4% 第三档），总计 3%-10%。
 *
 * @module backend/services/veteranService
 */

/** core 三档系数 × max_battle_count（M 通常 60 → 180 / 360 / 540 场） */
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

function normalizeInstanceIds(instanceIds) {
  if (!Array.isArray(instanceIds)) return [];
  return [...new Set(instanceIds.map((id) => String(id).trim()).filter(Boolean))];
}

function getCoreVeteranLifetimeThreshold(tier, maxBattleCount) {
  const t = Math.max(0, Math.floor(Number(tier) || 0));
  if (t >= VETERAN_THRESHOLDS.length) return Infinity;
  const m = Math.max(1, Math.floor(Number(maxBattleCount) || 60));
  return VETERAN_THRESHOLDS[t] * m;
}

/**
 * 检查指定玩家部队卡是否达到晋升阈值并写库。
 * **仅处理本场参战实例**（`options.instanceIds`）；未传则跳过（避免军营未出战卡误晋升）。
 * **每张卡每次调用最多晋升 1 档**。
 *
 * @param {Function} query - (sql, params) => Promise（pool.query 或事务 conn.query）
 * @param {string} playerId
 * @param {{ instanceIds?: string[] }} [options]
 * @returns {Promise<Array<{ instanceId: string, cardId: string, cardName: string, rarity: string, newTier: number, rollPct: number, totalPct: number }>>}
 */
async function checkAndApplyVeteran(query, playerId, options = {}) {
  const participantIds = normalizeInstanceIds(options.instanceIds);
  if (participantIds.length === 0) return [];

  const placeholders = participantIds.map(() => '?').join(',');
  const [rows] = await query(
    `SELECT pc.instance_id, pc.card_id, pc.lifetime_battle_count,
            pc.max_battle_count, pc.veteran_tier, pc.veteran_bonus_pct,
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

    const threshold =
      effectiveRarity === 'legendary'
        ? LEGENDARY_VETERAN_LIFETIME_THRESHOLDS[tier]
        : getCoreVeteranLifetimeThreshold(tier, row.max_battle_count);
    if (lifetime < threshold) continue;

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
  VETERAN_THRESHOLDS,
  LEGENDARY_VETERAN_LIFETIME_THRESHOLDS,
  VETERAN_ROLL_RANGE,
  getCoreVeteranLifetimeThreshold,
  checkAndApplyVeteran,
  normalizeInstanceIds,
};
