-- 将领重复增强槽位（21-1 §8.3.5）；仅 card_type=character 使用

ALTER TABLE player_cards
  ADD COLUMN character_enhance_slots JSON NULL
    COMMENT '将领增强槽 [attack|defense + pct + source]，长度 3'
    AFTER morale;
