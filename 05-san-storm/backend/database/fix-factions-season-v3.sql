-- ==========================================
-- 修正势力配置表的 season 字段（版本3）
-- 安全地删除和重命名字段
-- ==========================================

USE 05_san_storm;

-- 1. 先查看当前表结构
SELECT '=== 当前表结构 ===' as info;
SHOW COLUMNS FROM config_factions;

-- 2. 删除旧的 season 字段（如果存在，存储 S1, S2 格式）
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS 
   WHERE TABLE_SCHEMA = '05_san_storm' 
   AND TABLE_NAME = 'config_factions' 
   AND COLUMN_NAME = 'season' 
   AND COLUMN_TYPE = 'varchar(20)') > 0,
  'ALTER TABLE config_factions DROP COLUMN season',
  'SELECT "season 字段不存在或已是正确类型" as status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 将 season_id 重命名为 season（如果 season_id 存在）
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS 
   WHERE TABLE_SCHEMA = '05_san_storm' 
   AND TABLE_NAME = 'config_factions' 
   AND COLUMN_NAME = 'season_id') > 0,
  'ALTER TABLE config_factions CHANGE COLUMN season_id season VARCHAR(20) NOT NULL COMMENT "赛季ID（如：san_1, san_2，从faction_id中提取）"',
  'SELECT "season_id 字段不存在" as status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. 确保有 idx_season 索引
ALTER TABLE config_factions ADD INDEX IF NOT EXISTS idx_season (season);

-- 5. 验证修改结果
SELECT '=== 修改后的表结构 ===' as info;
SHOW COLUMNS FROM config_factions;

SELECT '=== 示例数据 ===' as info;
SELECT faction_id, season, faction_name FROM config_factions LIMIT 5;

SELECT '=== 赛季分布 ===' as info;
SELECT season, COUNT(*) as count FROM config_factions GROUP BY season;

