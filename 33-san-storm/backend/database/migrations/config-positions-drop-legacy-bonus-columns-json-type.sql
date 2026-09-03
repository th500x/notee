-- config_positions：删除未使用的 legacy DECIMAL 加成列；position_bonuses longtext → JSON
-- 生产/本地：在 backend 目录执行 node scripts/apply-pending-local-ddl.js
-- 或手动执行本文件（须先 USE 目标库）

UPDATE config_positions
SET position_bonuses = '{}'
WHERE position_bonuses IS NULL OR TRIM(position_bonuses) = '';

UPDATE config_positions
SET position_bonuses = '{}'
WHERE position_bonuses IS NOT NULL
  AND TRIM(position_bonuses) <> ''
  AND JSON_VALID(position_bonuses) = 0;

ALTER TABLE config_positions
  DROP COLUMN resource_bonus,
  DROP COLUMN prestige_bonus,
  DROP COLUMN infantry_bonus,
  DROP COLUMN cavalry_bonus,
  DROP COLUMN archer_bonus;

ALTER TABLE config_positions
  MODIFY COLUMN position_bonuses JSON NULL
  COMMENT '官职加成：reputation/contribution=俸禄固定整数；resource=俸禄银粮倍数；infantry/cavalry/archer=战斗小数比例';
