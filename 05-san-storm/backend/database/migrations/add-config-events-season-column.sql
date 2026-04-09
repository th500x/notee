-- 与 docs/00-base/01-DATABASE_DESIGN.md §3.3.12 对齐：config_events 增加 season（与 event_id 前缀一致，便于 WHERE season=?）
-- 执行一次。已有列则勿重复执行。

ALTER TABLE config_events ADD COLUMN season VARCHAR(20) NULL COMMENT '赛季ID（从 event_id 解析，如 san_1）';

UPDATE config_events SET season = SUBSTRING_INDEX(event_id, '_', 2) WHERE season IS NULL OR season = '';

ALTER TABLE config_events MODIFY COLUMN season VARCHAR(20) NOT NULL COMMENT '赛季ID（从 event_id 解析）';

ALTER TABLE config_events ADD INDEX idx_season (season);
