-- factions：资源储备列重命名（与 01-DATABASE_DESIGN.md §3.2.10 一致）
-- 已为新列名时可跳过（apply-pending-local-ddl 会吞 Unknown column）。

ALTER TABLE factions
  CHANGE COLUMN silver_reserve reserve_silver INT DEFAULT 0 COMMENT '银两储备（势力公共池；见 11-3）',
  CHANGE COLUMN food_reserve reserve_food INT DEFAULT 0 COMMENT '粮草储备（势力公共池；见 11-3）';
