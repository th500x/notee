-- config_events：移除未使用的 tags 列（01-database-split/70-tables-config §3.3.12）
ALTER TABLE config_events DROP COLUMN tags;
