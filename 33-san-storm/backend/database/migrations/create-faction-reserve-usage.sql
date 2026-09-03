-- 势力储备池 · 累计消耗（大分类统计，非流水明细）
-- 见 factionReserveUsageService.js

CREATE TABLE IF NOT EXISTS faction_reserve_usage (
  faction_id VARCHAR(50) NOT NULL COMMENT '势力ID',
  category VARCHAR(32) NOT NULL COMMENT 'war_start | march_food | stipend_bonus',
  silver_spent BIGINT NOT NULL DEFAULT 0 COMMENT '累计消耗银两',
  food_spent BIGINT NOT NULL DEFAULT 0 COMMENT '累计消耗粮草',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (faction_id, category),
  INDEX idx_faction (faction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='势力储备累计消耗（按大类）';
