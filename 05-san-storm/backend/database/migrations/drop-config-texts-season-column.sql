-- 01-database-split/70-tables-config §3.3.14：config_texts 不设 season
-- 仅当列 season 存在时执行。

ALTER TABLE config_texts DROP COLUMN season;
