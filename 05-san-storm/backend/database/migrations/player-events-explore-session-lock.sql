-- 探索/教程链会话锁：跨设备识别「进行中」的事件链（与客户端独占 UI 对齐；见 playerExploreEventService）
ALTER TABLE player_events
  ADD COLUMN explore_session_lock JSON NULL COMMENT 'JSON：chain_id / anchor_event_id / trigger_context 等；NULL 表示无锁';
