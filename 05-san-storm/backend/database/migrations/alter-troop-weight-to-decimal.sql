-- 兵力权重支持小数（如燕云十八 troop_weight=3.5）
-- mysql ... < migrations/alter-troop-weight-to-decimal.sql

ALTER TABLE config_troops
  MODIFY COLUMN troop_weight DECIMAL(5,2) NOT NULL DEFAULT 1.00
  COMMENT '兵力权重（等效兵力=max_troops×troop_weight，可小数）';
