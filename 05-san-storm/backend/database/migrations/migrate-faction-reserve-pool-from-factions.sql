-- 自 factions.reserve_* 迁入 pool 行（列已删则跳过本文件，改跑 apply-faction-reserve-unified.js）

INSERT INTO faction_reserve (faction_id, category, silver, food, recovery_applied_date)
SELECT id, 'pool', COALESCE(reserve_silver, 0), COALESCE(reserve_food, 0), reserve_recovery_applied_date
FROM factions
ON DUPLICATE KEY UPDATE
  silver = VALUES(silver),
  food = VALUES(food),
  recovery_applied_date = COALESCE(VALUES(recovery_applied_date), faction_reserve.recovery_applied_date);
