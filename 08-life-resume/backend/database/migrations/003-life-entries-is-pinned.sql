-- 人生片段：条目置顶（时间轴顶部优先展示）
ALTER TABLE life_entries
  ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否置顶' AFTER timeline_sort_key;

CREATE INDEX idx_entries_owner_pinned_timeline
  ON life_entries (account_id, is_pinned, timeline_sort_key);
