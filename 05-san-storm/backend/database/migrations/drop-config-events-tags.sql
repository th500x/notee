-- config_events：移除未使用的 tags 列（管线写 NULL；与 01-DATABASE_DESIGN §3.3.12 一致）
ALTER TABLE config_events DROP COLUMN tags;
