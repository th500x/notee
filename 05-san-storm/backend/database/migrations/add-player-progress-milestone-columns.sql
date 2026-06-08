-- player_progress：称号/成就里程碑进度（见 20-tables-player §4、25-1、25-2）
-- achievement_progress：成就链进度与指标缓存（赛季重置清零）
-- title_progress：称号任职天数、战令标记等（阶段 B 写入）

ALTER TABLE player_progress
  ADD COLUMN achievement_progress JSON NULL COMMENT '成就进度 v1：metrics/chains，赛季重置',
  ADD COLUMN title_progress JSON NULL COMMENT '称号进度：tenureByPositionLevel、hasPremium 等';
