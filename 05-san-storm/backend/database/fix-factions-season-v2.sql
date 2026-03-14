-- ==========================================
-- 修正势力配置表的 season 字段（版本2）
-- 删除旧的 season 字段，将 season_id 重命名为 season
-- ==========================================

USE 05_san_storm;

-- 1. 删除旧的 season 字段（存储 S1, S2 格式的字段）
ALTER TABLE config_factions DROP COLUMN season;

-- 2. 将 season_id 重命名为 season
ALTER TABLE config_factions 
CHANGE COLUMN season_id season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从faction_id中提取）';

-- 3. 删除旧的 season_id 索引
ALTER TABLE config_factions DROP INDEX idx_season_id;

-- 4. 确保 season 字段有索引
ALTER TABLE config_factions ADD INDEX idx_season (season);

-- 5. 验证修改结果
SELECT '=== 势力配置表结构 ===' as info;
DESCRIBE config_factions;

SELECT '=== 示例数据 ===' as info;
SELECT faction_id, season, faction_name FROM config_factions LIMIT 5;

SELECT '=== 赛季分布 ===' as info;
SELECT season, COUNT(*) as count FROM config_factions GROUP BY season;

