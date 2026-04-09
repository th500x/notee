/* temp_ranking_snapshots: add updated_at (align with temp_character_ranking_snapshots / other temp tables) */

ALTER TABLE temp_ranking_snapshots
  ADD COLUMN updated_at DATETIME NULL DEFAULT NULL COMMENT 'row last modified' AFTER created_at;

UPDATE temp_ranking_snapshots
SET updated_at = COALESCE(frozen_at, created_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

ALTER TABLE temp_ranking_snapshots
  MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'row last modified';
