-- 探索配额字段：从 localStorage 迁移到服务端存储
-- 解决跨浏览器（系统浏览器 vs 微信内置浏览器）各自独立恢复次数的bug

ALTER TABLE player_events
  ADD COLUMN explore_quota_remaining INT DEFAULT NULL COMMENT '探索剩余次数（NULL=首次使用，由后端初始化）',
  ADD COLUMN explore_quota_refill_ts VARCHAR(20) DEFAULT NULL COMMENT '上次恢复的整点时间戳（毫秒字符串）';
