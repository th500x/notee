-- 三公府 · 朝政 · 文书：一品（position_level=1）每日发布上限
ALTER TABLE player_events
  ADD COLUMN san_gong_document_date DATE NULL DEFAULT NULL
    COMMENT '文书发布日历日（CURDATE）',
  ADD COLUMN san_gong_document_count INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT '当日已发布文书条数（上限 3）';
