-- 11-life-resume: 地点名称 + Google 地图链接（支持无经纬度的具名 POI）
-- 注：MySQL 5.7 无 ADD COLUMN IF NOT EXISTS；重复执行由 apply-pending-local-ddl.js 捕获 ER_DUP_FIELDNAME
ALTER TABLE life_entries
  ADD COLUMN location_place_name VARCHAR(256) NULL COMMENT '地点名称（如餐厅全名，仅 owner 可读）' AFTER location_public_label,
  ADD COLUMN location_maps_url VARCHAR(1024) NULL COMMENT 'Google 地图分享链接（owner 跳转用）' AFTER location_place_name;
