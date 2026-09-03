-- 一次性迁移：最旧表名 → temp_character_ranking_snapshots（与 temp_ranking_snapshots 用语对齐）
-- 仅在曾执行过 create-player-character-rank-snapshot.sql 的环境运行

RENAME TABLE player_character_rank_snapshot TO temp_character_ranking_snapshots;

-- 若旧表列名为 score，改为 ranking_score（若已是 ranking_score 会报错，可跳过本句）
ALTER TABLE temp_character_ranking_snapshots
  CHANGE COLUMN score ranking_score DECIMAL(18, 8) NOT NULL COMMENT '加权综合分（用于排序）';
