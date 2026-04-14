-- 背包 JSON：item_badge → item_season_badge（须先于 rename-config-items-item-badge-to-item-season-badge.sql 执行）
UPDATE players
SET items = JSON_SET(
  JSON_REMOVE(items, '$.item_badge'),
  '$.item_season_badge',
  JSON_EXTRACT(items, '$.item_badge')
)
WHERE JSON_CONTAINS_PATH(items, 'one', '$.item_badge');
