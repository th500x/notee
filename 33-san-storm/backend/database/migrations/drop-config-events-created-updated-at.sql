/* config_events：删 created_at/updated_at；先部署后端再执行；列已删则 1091 可忽略 */

ALTER TABLE config_events DROP COLUMN created_at;
ALTER TABLE config_events DROP COLUMN updated_at;
