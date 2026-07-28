-- 三公府 · 军备：贡献兑兵符/玉牌日限（自然日 CURDATE）
ALTER TABLE player_events
  ADD COLUMN san_gong_armament_date DATE NULL
    COMMENT '军备兑换日（与 token/jade 计数同日）' AFTER san_gong_gift_box_date,
  ADD COLUMN san_gong_armament_token_count TINYINT UNSIGNED NOT NULL DEFAULT 0
    COMMENT '当日已兑兵符件数' AFTER san_gong_armament_date,
  ADD COLUMN san_gong_armament_jade_count TINYINT UNSIGNED NOT NULL DEFAULT 0
    COMMENT '当日已兑玉牌件数' AFTER san_gong_armament_token_count;
