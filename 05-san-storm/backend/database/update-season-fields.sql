-- ==========================================
-- 更新配置表的 season 字段
-- 从ID中提取赛季信息并填充到 season 字段
-- ==========================================

USE 05_san_storm;

-- ==========================================
-- 1. 为势力配置表添加 season 字段
-- ==========================================
ALTER TABLE config_factions 
ADD COLUMN IF NOT EXISTS season VARCHAR(20) NOT NULL DEFAULT '' COMMENT '赛季ID（如：san_1, san_2，从faction_id中提取）' AFTER faction_id,
ADD INDEX IF NOT EXISTS idx_season (season);

-- 更新势力配置表的 season 字段
UPDATE config_factions 
SET season = SUBSTRING_INDEX(SUBSTRING_INDEX(faction_id, '_', 2), 'san_', -1)
WHERE season = '' OR season IS NULL;

-- ==========================================
-- 2. 为将领配置表添加 season 字段
-- ==========================================
ALTER TABLE config_characters 
ADD COLUMN IF NOT EXISTS season VARCHAR(20) NOT NULL DEFAULT '' COMMENT '赛季ID（如：san_1, san_2，从character_id中提取）' AFTER character_id,
ADD INDEX IF NOT EXISTS idx_season (season);

-- 更新将领配置表的 season 字段
UPDATE config_characters 
SET season = SUBSTRING_INDEX(SUBSTRING_INDEX(character_id, '_', 2), 'san_', -1)
WHERE season = '' OR season IS NULL;

-- ==========================================
-- 3. 为部队配置表添加 season 字段
-- ==========================================
ALTER TABLE config_troops 
ADD COLUMN IF NOT EXISTS season VARCHAR(20) NOT NULL DEFAULT '' COMMENT '赛季ID（如：san_1, san_2，从troop_id中提取）' AFTER troop_id,
ADD INDEX IF NOT EXISTS idx_season (season);

-- 更新部队配置表的 season 字段
UPDATE config_troops 
SET season = SUBSTRING_INDEX(SUBSTRING_INDEX(troop_id, '_', 2), 'san_', -1)
WHERE season = '' OR season IS NULL;

-- ==========================================
-- 4. 为装备配置表添加 season 字段
-- ==========================================
ALTER TABLE config_equipment 
ADD COLUMN IF NOT EXISTS season VARCHAR(20) NOT NULL DEFAULT '' COMMENT '赛季ID（如：san_1, san_2，从equipment_id中提取）' AFTER equipment_id,
ADD INDEX IF NOT EXISTS idx_season (season);

-- 更新装备配置表的 season 字段（如果有数据）
UPDATE config_equipment 
SET season = SUBSTRING_INDEX(SUBSTRING_INDEX(equipment_id, '_', 2), 'san_', -1)
WHERE season = '' OR season IS NULL;

-- ==========================================
-- 5. 为官职配置表添加 season 字段
-- ==========================================
ALTER TABLE config_positions 
ADD COLUMN IF NOT EXISTS season VARCHAR(20) NOT NULL DEFAULT '' COMMENT '赛季ID（如：san_1, san_2，从position_id中提取）' AFTER position_id,
ADD INDEX IF NOT EXISTS idx_season (season);

-- 更新官职配置表的 season 字段
UPDATE config_positions 
SET season = SUBSTRING_INDEX(SUBSTRING_INDEX(position_id, '_', 2), 'san_', -1)
WHERE season = '' OR season IS NULL;

-- ==========================================
-- 6. 为称号配置表添加 season 字段
-- ==========================================
ALTER TABLE config_titles 
ADD COLUMN IF NOT EXISTS season VARCHAR(20) NOT NULL DEFAULT '' COMMENT '赛季ID（如：san_1, san_2，从title_id中提取）' AFTER title_id,
ADD INDEX IF NOT EXISTS idx_season (season);

-- 更新称号配置表的 season 字段（如果有数据）
UPDATE config_titles 
SET season = SUBSTRING_INDEX(SUBSTRING_INDEX(title_id, '_', 2), 'san_', -1)
WHERE season = '' OR season IS NULL;

-- ==========================================
-- 7. 为成就配置表添加 season 字段
-- ==========================================
ALTER TABLE config_achievements 
ADD COLUMN IF NOT EXISTS season VARCHAR(20) NOT NULL DEFAULT '' COMMENT '赛季ID（如：san_1, san_2，从achievement_id中提取）' AFTER achievement_id,
ADD INDEX IF NOT EXISTS idx_season (season);

-- 更新成就配置表的 season 字段（如果有数据）
UPDATE config_achievements 
SET season = SUBSTRING_INDEX(SUBSTRING_INDEX(achievement_id, '_', 2), 'san_', -1)
WHERE season = '' OR season IS NULL;

-- ==========================================
-- 验证更新结果
-- ==========================================

-- 查看势力配置表的 season 分布
SELECT season, COUNT(*) as count FROM config_factions GROUP BY season;

-- 查看将领配置表的 season 分布
SELECT season, COUNT(*) as count FROM config_characters GROUP BY season;

-- 查看部队配置表的 season 分布
SELECT season, COUNT(*) as count FROM config_troops GROUP BY season;

-- 查看官职配置表的 season 分布
SELECT season, COUNT(*) as count FROM config_positions GROUP BY season;

