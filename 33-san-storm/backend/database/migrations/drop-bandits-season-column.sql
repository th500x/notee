-- 01-database-split/30-tables-world §3.2.11a：bandits 不存 season
-- 仅当表 bandits 且列 season 存在时执行。

ALTER TABLE bandits DROP COLUMN season;
