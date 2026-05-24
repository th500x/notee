-- 大司空日榜：复用 temp_ranking_snapshots，标记 baseline 所属自然日
-- event_id 固定为 san_1_king_dasikong_daily（按赛季扩展时改前缀）
-- 与活动榜共用 delta 算法：statistics 当前值 − snapshot_* 列

ALTER TABLE temp_ranking_snapshots
  ADD COLUMN baseline_date DATE NULL DEFAULT NULL
    COMMENT '日榜 baseline 所属自然日（大司空 event_id 使用）'
    AFTER snapshot_food;

ALTER TABLE temp_ranking_snapshots
  ADD KEY idx_event_baseline (event_id, baseline_date);
