-- 战报关联 PVP 战事：`battles.pvp_war_id` → `wars_pvp.pvp_war_id`
-- 与现有 `war_id`（PVE `wars`）互斥：应用层保证至多其一非空。
-- 依赖：`wars_pvp` 表已创建。
-- 重复执行：若列/索引已存在则 apply 脚本会 SKIP

ALTER TABLE battles
  ADD COLUMN pvp_war_id VARCHAR(64) NULL COMMENT 'PVP势力战事ID → wars_pvp.pvp_war_id（与 war_id 至多其一）' AFTER war_id,
  ADD INDEX idx_battles_pvp_war_id (pvp_war_id);
