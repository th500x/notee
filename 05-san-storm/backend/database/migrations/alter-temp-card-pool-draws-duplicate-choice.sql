-- 卡池重复三选一 pending 状态（21-1 §8.3.4）

ALTER TABLE temp_card_pool_draws
  ADD COLUMN duplicate_choice_status ENUM('none', 'pending', 'resolved') NOT NULL DEFAULT 'none'
    COMMENT '将领重复三选一状态'
    AFTER compensated,
  ADD COLUMN duplicate_choice_payload JSON NULL
    COMMENT 'pending 快照：targetInstanceId、cardId、poolEnhanceSlotsUsed 等'
    AFTER duplicate_choice_status;
