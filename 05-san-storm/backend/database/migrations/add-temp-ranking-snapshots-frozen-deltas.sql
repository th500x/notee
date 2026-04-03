-- 活动排行榜：活动结束后冻结四项增量，避免 statistics 继续增长导致分数变化
-- 需与 routes/rankings.js 中 COALESCE(frozen_delta_*, 实时差值) 配合使用
-- @see config/activityRankingEvents.js（与 game announcements.js 活动时间同步）

ALTER TABLE temp_ranking_snapshots
  ADD COLUMN frozen_at DATETIME NULL DEFAULT NULL COMMENT '非空表示已冻结',
  ADD COLUMN frozen_delta_battle INT NULL,
  ADD COLUMN frozen_delta_events INT NULL,
  ADD COLUMN frozen_delta_rep_contrib INT NULL,
  ADD COLUMN frozen_delta_silver_food INT NULL;
