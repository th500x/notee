/**
 * 战斗后部队耐久耗尽处理（上阵编组与驻守槽位一致）
 * 橙 legendary / 金 core：保留实例，可继续装备上阵（战斗内攻防磨耗见 combatSystem）；
 * 白/蓝/紫：删除实例。
 * 驻守槽：除橙/金外，耐久用尽或实例已删的部队从 char*_troop* 强制清空。
 *
 * @param {Function} query - (sql, params) => Promise，如 pool.query 或事务 conn.query
 * @param {string} playerId
 */
async function clearExhaustedOrMissingTroopsFromGarrison(query, playerId) {
  await query(
    `UPDATE player_lineup_sets g
     LEFT JOIN player_cards pc1 ON pc1.instance_id = g.char1_troop1 AND pc1.player_id = g.player_id
     LEFT JOIN player_cards pc2 ON pc2.instance_id = g.char1_troop2 AND pc2.player_id = g.player_id
     LEFT JOIN player_cards pc3 ON pc3.instance_id = g.char2_troop1 AND pc3.player_id = g.player_id
     LEFT JOIN player_cards pc4 ON pc4.instance_id = g.char2_troop2 AND pc4.player_id = g.player_id
     SET
       g.char1_troop1 = IF(
         g.char1_troop1 IS NOT NULL AND (
           pc1.instance_id IS NULL OR (
             pc1.card_type = 'troop' AND pc1.rarity NOT IN ('legendary', 'core')
             AND pc1.max_battle_count IS NOT NULL AND pc1.battle_count >= pc1.max_battle_count
           )
         ), NULL, g.char1_troop1),
       g.char1_troop2 = IF(
         g.char1_troop2 IS NOT NULL AND (
           pc2.instance_id IS NULL OR (
             pc2.card_type = 'troop' AND pc2.rarity NOT IN ('legendary', 'core')
             AND pc2.max_battle_count IS NOT NULL AND pc2.battle_count >= pc2.max_battle_count
           )
         ), NULL, g.char1_troop2),
       g.char2_troop1 = IF(
         g.char2_troop1 IS NOT NULL AND (
           pc3.instance_id IS NULL OR (
             pc3.card_type = 'troop' AND pc3.rarity NOT IN ('legendary', 'core')
             AND pc3.max_battle_count IS NOT NULL AND pc3.battle_count >= pc3.max_battle_count
           )
         ), NULL, g.char2_troop1),
       g.char2_troop2 = IF(
         g.char2_troop2 IS NOT NULL AND (
           pc4.instance_id IS NULL OR (
             pc4.card_type = 'troop' AND pc4.rarity NOT IN ('legendary', 'core')
             AND pc4.max_battle_count IS NOT NULL AND pc4.battle_count >= pc4.max_battle_count
           )
         ), NULL, g.char2_troop2)
     WHERE g.player_id = ?`,
    [playerId]
  );

  await query(
    `UPDATE player_lineup_sets
     SET is_active = (
       (char1_card IS NOT NULL OR char2_card IS NOT NULL)
       AND (char1_troop1 IS NOT NULL OR char1_troop2 IS NOT NULL OR char2_troop1 IS NOT NULL OR char2_troop2 IS NOT NULL)
     )
     WHERE player_id = ? AND lineup_scope = 'garrison'`,
    [playerId]
  );
}

async function applyTroopDurabilityExhaustion(query, playerId) {
  // 金/橙均保留可装备；仅白/蓝/紫删卡
  await query(
    `DELETE FROM player_cards 
     WHERE player_id = ? AND card_type = 'troop' AND rarity IN ('common', 'rare', 'epic')
       AND max_battle_count IS NOT NULL
       AND battle_count >= max_battle_count`,
    [playerId]
  );

  await clearExhaustedOrMissingTroopsFromGarrison(query, playerId);
}

module.exports = {
  applyTroopDurabilityExhaustion,
  clearExhaustedOrMissingTroopsFromGarrison,
};
