/* temp_event_ranking: add updated_at (align with temp_character_ranking / other temp tables)
   老库若仍为 temp_ranking_snapshots，请先跑 rename-temp-ranking-snapshots-to-temp-event-ranking.sql */

ALTER TABLE temp_event_ranking
  ADD COLUMN updated_at DATETIME NULL DEFAULT NULL COMMENT 'row last modified' AFTER created_at;

UPDATE temp_event_ranking
SET updated_at = COALESCE(frozen_at, created_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

ALTER TABLE temp_event_ranking
  MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'row last modified';
