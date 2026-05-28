-- 势力储备 · 每日 00:00 自动恢复幂等标记（与 15-2 / factionReserveRecoveryService 一致）
-- 依赖：factions 表已存在

ALTER TABLE factions
  ADD COLUMN reserve_recovery_applied_date DATE NULL
    COMMENT '上次执行势力储备日恢复的服务器日历日（CURDATE）' AFTER reserve_food;
