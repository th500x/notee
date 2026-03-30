-- config_items：道具特殊效果（如 repair_min_durability_full_legendary / repair_min_durability_full_core）
-- 执行: mysql -u... -p... DB_NAME < migrations/add-special-effect-to-config-items.sql

ALTER TABLE config_items
  ADD COLUMN special_effect VARCHAR(128) NULL DEFAULT NULL COMMENT '道具特殊效果标识' AFTER version;
