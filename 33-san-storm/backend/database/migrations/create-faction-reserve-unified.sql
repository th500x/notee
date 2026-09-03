-- 势力储备统一表（余额 pool 行 + 出账累计行）
-- 数据迁入：migrate-faction-reserve-pool-from-factions.sql → migrate-faction-reserve-usage-into-unified.sql → factions-drop-reserve-columns.sql
-- 若 factions.reserve_* 已删而本表为空，可运行 node scripts/apply-faction-reserve-unified.js

CREATE TABLE IF NOT EXISTS faction_reserve (
  faction_id VARCHAR(50) NOT NULL COMMENT '势力ID',
  category VARCHAR(32) NOT NULL COMMENT 'pool=余额与恢复幂等; war_start|march_food|stipend_bonus=累计出账',
  silver BIGINT NOT NULL DEFAULT 0 COMMENT 'pool:当前银储备; 其它:累计消耗银',
  food BIGINT NOT NULL DEFAULT 0 COMMENT 'pool:当前粮储备; 其它:累计消耗粮',
  recovery_applied_date DATE NULL COMMENT '仅 category=pool：上次日恢复 CURDATE 幂等',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (faction_id, category),
  INDEX idx_faction (faction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='势力银粮储备（pool）与出账累计（按大类）';
