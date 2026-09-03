-- 道具卡池 + 道具类型 chapter_tactical（取代 season_token）
-- 1) config_items：迁旧 ID / 清 season_token 类型，再缩 ENUM
-- 2) temp_card_pool_draws：pool_type 增加 item
-- 3) players.items：item_season_token 键并入 item_token

-- ── config_items：旧兵符 ID → item_token（若目标已存在则删旧行）──
UPDATE config_items
SET item_id = 'item_token'
WHERE item_id = 'item_season_token'
  AND NOT EXISTS (
    SELECT 1 FROM (
      SELECT item_id FROM config_items WHERE item_id = 'item_token'
    ) AS t
  );

DELETE FROM config_items WHERE item_id = 'item_season_token';

-- 缩 ENUM 前不能残留 season_token
UPDATE config_items
SET item_type = 'event_key'
WHERE item_type = 'season_token';

ALTER TABLE config_items
  MODIFY COLUMN item_type ENUM('event_key', 'season_badge', 'chapter_tactical') NOT NULL DEFAULT 'event_key'
  COMMENT 'event_key=钥匙类; season_badge=赛季徽章; chapter_tactical=篇章战术信物(兵符/玉牌)';

-- ── 卡池抽取记录：支持道具池 ──
ALTER TABLE temp_card_pool_draws
  MODIFY COLUMN pool_type ENUM('troop', 'character', 'item') NOT NULL
  COMMENT '卡池类型（troop=部队, character=将领, item=道具）';

-- ── 玩家背包 JSON：item_season_token → item_token（有则合并数量）──
UPDATE players
SET items = JSON_REMOVE(
  JSON_SET(
    COALESCE(items, '{}'),
    '$.item_token',
    COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(items, '$.item_token')) AS UNSIGNED), 0)
      + COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(items, '$.item_season_token')) AS UNSIGNED), 0)
  ),
  '$.item_season_token'
)
WHERE JSON_EXTRACT(items, '$.item_season_token') IS NOT NULL;
