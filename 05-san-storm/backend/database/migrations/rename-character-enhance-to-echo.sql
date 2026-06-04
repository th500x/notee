-- 将领残影 Echo · 存量库列重命名（21-1 §8.3）
-- 前提：旧列存在、无业务数据需迁移；列已为新名时由 apply-pending-local-ddl 跳过。

ALTER TABLE player_cards
  CHANGE COLUMN character_enhance_slots character_echo_slots JSON NULL
    COMMENT '将领残影槽 [attack|defense + pct + source]，长度 3';

ALTER TABLE temp_card_pool_draws
  CHANGE COLUMN duplicate_choice_status echo_choice_status ENUM('none', 'pending', 'resolved') NOT NULL DEFAULT 'none'
    COMMENT '将领重复残影三选一状态';

ALTER TABLE temp_card_pool_draws
  CHANGE COLUMN duplicate_choice_payload echo_choice_payload JSON NULL
    COMMENT 'pending 快照：targetInstanceId、cardId、poolEchoSlotsUsed 等';
