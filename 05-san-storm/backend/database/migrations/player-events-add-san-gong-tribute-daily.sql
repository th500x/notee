-- 三公府朝贡：按服务器日历日限制每日上缴部队卡张数（与 CURDATE() 比较）
ALTER TABLE player_events
  ADD COLUMN san_gong_tribute_date DATE NULL DEFAULT NULL
    COMMENT '朝贡计数所属服务器日历日',
  ADD COLUMN san_gong_tribute_count INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT '当日已朝贡（销毁）的部队卡张数';
