-- 与 docs/00-base/01-DATABASE_DESIGN.md §3.2.12 对齐：legions 不再冗余 season（经 faction_id → factions.season）
-- 仅当库中仍存在 legions.season 时执行；列已删可跳过。MySQL 会同时移除仅包含该列的索引（如 idx_season）。

ALTER TABLE legions DROP COLUMN season;
