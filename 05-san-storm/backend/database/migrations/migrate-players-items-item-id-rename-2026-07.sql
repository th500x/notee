-- 玩家背包 JSON 键：道具 ID 重命名（与 docs/tools/event/item-template.csv 对齐）
-- item_season_badge → item_badge_season
-- item_token → item_tactic_token
-- item_jade → item_tactic_jade
-- 数量合并到新键后删除旧键

-- 黄巾徽章
UPDATE players
SET items = JSON_REMOVE(
  JSON_SET(
    items,
    '$.item_badge_season',
    COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(items, '$.item_badge_season')) AS UNSIGNED), 0)
      + COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(items, '$.item_season_badge')) AS UNSIGNED), 0)
  ),
  '$.item_season_badge'
)
WHERE JSON_EXTRACT(items, '$.item_season_badge') IS NOT NULL;

-- 兵符
UPDATE players
SET items = JSON_REMOVE(
  JSON_SET(
    items,
    '$.item_tactic_token',
    COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(items, '$.item_tactic_token')) AS UNSIGNED), 0)
      + COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(items, '$.item_token')) AS UNSIGNED), 0)
  ),
  '$.item_token'
)
WHERE JSON_EXTRACT(items, '$.item_token') IS NOT NULL;

-- 玉牌
UPDATE players
SET items = JSON_REMOVE(
  JSON_SET(
    items,
    '$.item_tactic_jade',
    COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(items, '$.item_tactic_jade')) AS UNSIGNED), 0)
      + COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(items, '$.item_jade')) AS UNSIGNED), 0)
  ),
  '$.item_jade'
)
WHERE JSON_EXTRACT(items, '$.item_jade') IS NOT NULL;
