-- 一次性数据修复：部队卡 battle_count 为负或超过 max_battle_count 时钳制到 [0, max_battle_count]
-- 可与 fix-battle-count-overflow.sql 一并执行；上线后若仍见负数，可先跑本脚本再查是否还有写入路径

UPDATE player_cards
SET battle_count = LEAST(
  GREATEST(COALESCE(battle_count, 0), 0),
  COALESCE(max_battle_count, 60)
)
WHERE card_type = 'troop'
  AND (
    COALESCE(battle_count, 0) < 0
    OR (max_battle_count IS NOT NULL AND COALESCE(battle_count, 0) > max_battle_count)
  );
