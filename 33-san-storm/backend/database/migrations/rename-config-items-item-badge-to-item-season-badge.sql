-- config_items 主键：item_badge → item_season_badge（与 item-template.csv、public/data/shared/items.json 一致）
UPDATE config_items SET item_id = 'item_season_badge' WHERE item_id = 'item_badge';
