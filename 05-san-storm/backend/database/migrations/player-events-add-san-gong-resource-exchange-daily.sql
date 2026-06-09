-- 三公府封赏 · 银粮兑换：四兑换包各按服务器日历日 1 次（与俸禄 CURDATE() 口径一致）
ALTER TABLE player_events
  ADD COLUMN san_gong_exchange_silver_food_a_date DATE NULL DEFAULT NULL
    COMMENT '银→粮优享包上次兑换日',
  ADD COLUMN san_gong_exchange_silver_food_b_date DATE NULL DEFAULT NULL
    COMMENT '银→粮标准包上次兑换日',
  ADD COLUMN san_gong_exchange_food_silver_a_date DATE NULL DEFAULT NULL
    COMMENT '粮→银优享包上次兑换日',
  ADD COLUMN san_gong_exchange_food_silver_b_date DATE NULL DEFAULT NULL
    COMMENT '粮→银标准包上次兑换日';
