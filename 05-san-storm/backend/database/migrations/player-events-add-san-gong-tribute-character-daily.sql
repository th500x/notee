-- 三公府朝贡 · 将领：按服务器日历日限制每日上缴将领卡张数（与部队朝贡分列）
ALTER TABLE player_events
  ADD COLUMN san_gong_tribute_character_date DATE NULL DEFAULT NULL
    COMMENT '将领朝贡计数所属服务器日历日',
  ADD COLUMN san_gong_tribute_character_count INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT '当日已朝贡（销毁）的将领卡张数';
