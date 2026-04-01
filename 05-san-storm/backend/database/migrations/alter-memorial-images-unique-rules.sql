-- 兼容旧版 memorial_images：
-- 1) 移除旧唯一键 (player_id, image_type, event_date)
-- 2) 改为仅 daily / battle 每天唯一（milestone 同天可多条）
-- 3) 放宽 battle_id 到 VARCHAR(80)

ALTER TABLE memorial_images
  DROP INDEX idx_unique_daily;

ALTER TABLE memorial_images
  MODIFY COLUMN battle_id VARCHAR(80) NULL COMMENT '关联的战斗ID（仅battle类型使用）';

ALTER TABLE memorial_images
  ADD COLUMN daily_event_date DATE GENERATED ALWAYS AS (
    CASE WHEN image_type = 'daily' THEN event_date ELSE NULL END
  ) STORED,
  ADD COLUMN battle_event_date DATE GENERATED ALWAYS AS (
    CASE WHEN image_type = 'battle' THEN event_date ELSE NULL END
  ) STORED;

ALTER TABLE memorial_images
  ADD UNIQUE KEY uk_daily_once_per_day (player_id, daily_event_date),
  ADD UNIQUE KEY uk_battle_once_per_day (player_id, battle_event_date);

