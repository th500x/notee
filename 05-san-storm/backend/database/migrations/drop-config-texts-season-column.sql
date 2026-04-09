-- 与 docs/00-base/01-DATABASE_DESIGN.md §3.3.14 对齐：config_texts 不设 season（未使用；赛季语义由 template_id 前缀等表达）
-- 仅当列 season 存在时执行。

ALTER TABLE config_texts DROP COLUMN season;
