-- 迁移：将 attack_range 改为 range
-- 日期：2025-03-13
-- 说明：修正字段命名，attack_range -> range

USE 05_san_storm;

-- 重命名字段（range 是 MySQL 保留字，需要用反引号）
ALTER TABLE config_troops
  CHANGE COLUMN attack_range `range` INT NOT NULL COMMENT '攻击距离';

SELECT '✅ 字段 attack_range 已重命名为 range' AS status;
