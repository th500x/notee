/* temp_character_ranking_snapshots：补充 created_at；老数据用 updated_at 回填；ON DUPLICATE KEY 不更新 created_at */

ALTER TABLE temp_character_ranking_snapshots
  ADD COLUMN created_at DATETIME NULL COMMENT '创建时间（首次插入）' AFTER charm;

UPDATE temp_character_ranking_snapshots SET created_at = updated_at WHERE created_at IS NULL;

ALTER TABLE temp_character_ranking_snapshots
  MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（首次插入）';
