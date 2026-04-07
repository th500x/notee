-- 与 public/data/shared/items.json 中 itemType 对齐；缺此项时 import-items-data 无法写入 season_badge（如 item_badge）。
ALTER TABLE config_items
  MODIFY COLUMN item_type ENUM('event_key', 'season_badge') NOT NULL DEFAULT 'event_key' COMMENT 'event_key=钥匙类; season_badge=赛季徽章';
