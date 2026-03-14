-- ==========================================
-- 为势力配置表添加 season 字段（最终版本）
-- ==========================================

USE 05_san_storm;

-- 1. 添加 season 字段
ALTER TABLE config_factions 
ADD COLUMN season VARCHAR(20) NOT NULL DEFAULT '' COMMENT '赛季ID（如：san_1, san_2，从faction_id中提取）' AFTER faction_id;

-- 2. 从 faction_id 中提取赛季信息并填充到 season 字段
UPDATE config_factions 
SET season = SUBSTRING_INDEX(SUBSTRING_INDEX(faction_id, '_', 2), 'san_', -1)
WHERE season = '' OR season IS NULL;

-- 3. 添加索引
ALTER TABLE config_factions ADD INDEX idx_season (season);

-- 4. 验证结果
SELECT '=== 示例数据 ===' as info;
SELECT faction_id, season, faction_name FROM config_factions LIMIT 5;

SELECT '=== 赛季分布 ===' as info;
SELECT season, COUNT(*) as count FROM config_factions GROUP BY season;

