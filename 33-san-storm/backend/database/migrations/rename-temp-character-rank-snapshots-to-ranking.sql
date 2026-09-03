-- 一次性迁移：temp_character_rank_snapshots → temp_character_ranking_snapshots
-- 仅在曾执行过 create-temp-character-rank-snapshots.sql 的环境运行

RENAME TABLE temp_character_rank_snapshots TO temp_character_ranking_snapshots;

ALTER TABLE temp_character_ranking_snapshots
  CHANGE COLUMN score ranking_score DECIMAL(18, 8) NOT NULL COMMENT '加权综合分（用于排序）';
