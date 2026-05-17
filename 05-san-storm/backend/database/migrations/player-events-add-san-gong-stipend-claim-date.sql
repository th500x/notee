-- 三公府封赏 · 俸禄：按服务器日历日限制每日领取次数（与 CURDATE() 比较，每日最多 1 次）
ALTER TABLE player_events
  ADD COLUMN san_gong_stipend_claim_date DATE NULL DEFAULT NULL
    COMMENT '上次领取俸禄的服务器日历日（与当日相等则今日已领）';
