-- 三公府封赏 · 礼盒：贡献兑换传奇宝物，每自然日 1 次（与俸禄/银粮兑换 CURDATE() 口径一致）
ALTER TABLE player_events
  ADD COLUMN san_gong_gift_box_date DATE NULL DEFAULT NULL
    COMMENT '礼盒上次兑换日';
