-- 卡池重复将领 · 残影三选一 pending（21-1 §8.3.4）

ALTER TABLE temp_card_pool_draws
  ADD COLUMN echo_choice_status ENUM('none', 'pending', 'resolved') NOT NULL DEFAULT 'none'
    COMMENT '将领重复残影三选一状态'
    AFTER compensated,
  ADD COLUMN echo_choice_payload JSON NULL
    COMMENT 'pending 快照：targetInstanceId、cardId、poolEchoSlotsUsed 等'
    AFTER echo_choice_status;
