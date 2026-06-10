ALTER TABLE player_cards
  ADD COLUMN uses_remaining INT NULL DEFAULT NULL
  COMMENT 'treasure only: NULL=permanent core; else remaining uses'
  AFTER max_battle_count;
