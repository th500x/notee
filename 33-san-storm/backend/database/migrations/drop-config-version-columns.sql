-- 移除各 config_* 表中的冗余 version 列（策划/管道不再维护行级版本号）。
-- 生产/预发：在部署已去掉 version 引用的后端与导入脚本之后执行。
--
-- 语法说明：使用标准 MySQL `DROP COLUMN`（**不含** IF EXISTS）。
-- MariaDB 10.3+ 虽支持 DROP COLUMN IF EXISTS，但 **MySQL / 多数 XAMPP 自带库不支持**，会报 1064。
-- 手工执行时：若某表无 `version` 列或表不存在，会报 1091 / 1146，**跳过该条即可**。
-- 自动执行（推荐）：backend 目录
--   node database/scripts/apply-drop-config-version-columns.js
--   脚本会对「列/表不存在」自动 SKIP。

ALTER TABLE config_factions DROP COLUMN version;
ALTER TABLE config_characters DROP COLUMN version;
ALTER TABLE config_troops DROP COLUMN version;
ALTER TABLE config_skills DROP COLUMN version;
ALTER TABLE config_bonds DROP COLUMN version;
ALTER TABLE config_equipment DROP COLUMN version;
ALTER TABLE config_formations DROP COLUMN version;
ALTER TABLE config_items DROP COLUMN version;
ALTER TABLE config_events DROP COLUMN version;
ALTER TABLE config_campaigns DROP COLUMN version;
ALTER TABLE config_achievements DROP COLUMN version;
