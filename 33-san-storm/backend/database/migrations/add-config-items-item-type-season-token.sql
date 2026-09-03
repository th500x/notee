-- 与 public/data/shared/items.json 中 itemType 对齐；缺此项时 import-items-data 无法写入 season_token（如 item_season_token 兵符）。
ALTER TABLE config_items
  MODIFY COLUMN item_type ENUM('event_key', 'season_badge', 'season_token') NOT NULL DEFAULT 'event_key'
  COMMENT 'event_key=钥匙类; season_badge=赛季徽章; season_token=赛季信物(兵符等)';
