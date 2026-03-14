-- ==========================================
-- 修正势力配置表的 season 字段
-- 将 season_id 重命名为 season，统一字段命名
-- ==========================================

USE 05_san_storm;

-- 1. 检查当前势力配置表结构
DESCRIBE config_factions;

-- 2. 如果存在 season_id 字段，重命名为 season
-- 注意：如果已经有 season 字段（存储 S1, S2），需要先删除或重命名

-- 2.1 先检查是否有旧的 season 字段（存储 S1, S2 格式）
-- 如果有，先删除它
ALTER TABLE config_factions DROP COLUMN IF EXISTS season;

-- 2.2 如果有 season_id 字段，重命名为 season
-- 如果没有 season_id 字段，直接添加 season 字段
ALTER TABLE config_factions 
CHANGE COLUMN season_id season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从faction_id中提取）';

-- 3. 确保 season 字段有索引
ALTER TABLE config_factions 
ADD INDEX IF NOT EXISTS idx_season (season);

-- 4. 删除旧的 season_id 索引（如果存在）
ALTER TABLE config_factions DROP INDEX IF EXISTS idx_season_id;

-- 5. 验证修改结果
SELECT faction_id, season, faction_name FROM config_factions LIMIT 5;

-- 6. 查看赛季分布
SELECT season, COUNT(*) as count FROM config_factions GROUP BY season;

