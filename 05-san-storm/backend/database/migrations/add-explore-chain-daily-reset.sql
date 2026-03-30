-- 南阳/山海关部队事件链：按服务器日历日重置完成状态（每日 0 点后首次请求时清理）
ALTER TABLE player_events
  ADD COLUMN explore_chain_reset_date DATE NULL DEFAULT NULL
    COMMENT '部队链探索进度上次重置日期（与 CURDATE() 比较）';
