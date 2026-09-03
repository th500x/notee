-- 将领残影 Echo 槽位（21-1 §8.3.5）；仅 card_type=character 使用

ALTER TABLE player_cards
  ADD COLUMN character_echo_slots JSON NULL
    COMMENT '将领残影槽 [attack|defense + pct + source]，长度 3'
    AFTER morale;
