-- 更新 config_equipment 表的属性字段
-- 执行时间：2025-01-XX
-- 原因：装备应该基于将领属性而不是部队属性，改为7项将领属性加成

USE 05_san_storm;

-- 删除旧的部队属性字段
ALTER TABLE config_equipment 
DROP COLUMN IF EXISTS attack_bonus,
DROP COLUMN IF EXISTS defense_bonus,
DROP COLUMN IF EXISTS speed_bonus;

-- 添加将领7项属性加成字段（×10存储）
ALTER TABLE config_equipment 
ADD COLUMN luck_bonus INT DEFAULT 0 COMMENT '运气加成×10' AFTER rarity,
ADD COLUMN courage_bonus INT DEFAULT 0 COMMENT '勇气加成×10' AFTER luck_bonus,
ADD COLUMN combat_bonus INT DEFAULT 0 COMMENT '武力加成×10' AFTER courage_bonus,
ADD COLUMN command_bonus INT DEFAULT 0 COMMENT '统帅加成×10' AFTER combat_bonus,
ADD COLUMN intelligence_bonus INT DEFAULT 0 COMMENT '智力加成×10' AFTER command_bonus,
ADD COLUMN politics_bonus INT DEFAULT 0 COMMENT '政治加成×10' AFTER intelligence_bonus,
ADD COLUMN charm_bonus INT DEFAULT 0 COMMENT '魅力加成×10' AFTER politics_bonus;

-- 验证修改
DESCRIBE config_equipment;
