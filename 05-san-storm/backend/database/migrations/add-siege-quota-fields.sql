-- 攻城配额字段（与探索配额机制一致）
ALTER TABLE player_events
  ADD COLUMN siege_quota_remaining INT DEFAULT NULL COMMENT '攻城剩余次数',
  ADD COLUMN siege_quota_refill_ts VARCHAR(20) DEFAULT NULL COMMENT '攻城上次恢复时间戳';
