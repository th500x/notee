-- 大司空日榜：temp_event_ranking 增加 baseline_date（baseline 所属自然日）
-- event_id 固定为 san_1_king_dasikong_daily（按赛季扩展时改前缀）
-- 与活动榜共用 delta 算法：statistics 当前值 − snapshot_* 列
-- 老库若仍为 temp_ranking_snapshots，请先跑 rename-temp-ranking-snapshots-to-temp-event-ranking.sql

ALTER TABLE temp_event_ranking
  ADD COLUMN baseline_date DATE NULL DEFAULT NULL
    COMMENT '日榜 baseline 所属自然日（大司空 event_id 使用）'
    AFTER snapshot_food;

ALTER TABLE temp_event_ranking
  ADD KEY idx_event_baseline (event_id, baseline_date);
