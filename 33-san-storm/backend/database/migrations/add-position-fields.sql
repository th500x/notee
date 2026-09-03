-- 为 config_positions 表添加缺失的字段
-- 执行时间：2025-01-XX
-- 原因：补充官职表缺失的字段，与CSV模板保持一致

USE 05_san_storm;

-- 添加 position_rank 字段
ALTER TABLE config_positions 
ADD COLUMN position_rank INT NOT NULL DEFAULT 0 COMMENT '官职排名（用于排序）' 
AFTER position_level;

-- 添加 icon 字段
ALTER TABLE config_positions 
ADD COLUMN icon VARCHAR(10) COMMENT '官职图标（emoji）' 
AFTER category;

-- 添加 color 字段
ALTER TABLE config_positions 
ADD COLUMN color VARCHAR(20) COMMENT '官职颜色（hex）' 
AFTER icon;

-- 添加 description 字段
ALTER TABLE config_positions 
ADD COLUMN description TEXT COMMENT '官职描述' 
AFTER color;

-- 添加加成字段
ALTER TABLE config_positions 
ADD COLUMN resource_bonus DECIMAL(5,2) DEFAULT 0 COMMENT '资源加成' 
AFTER requirement;

ALTER TABLE config_positions 
ADD COLUMN prestige_bonus DECIMAL(5,2) DEFAULT 0 COMMENT '声望加成' 
AFTER resource_bonus;

ALTER TABLE config_positions 
ADD COLUMN infantry_bonus DECIMAL(5,2) DEFAULT 0 COMMENT '步兵加成' 
AFTER prestige_bonus;

ALTER TABLE config_positions 
ADD COLUMN cavalry_bonus DECIMAL(5,2) DEFAULT 0 COMMENT '骑兵加成' 
AFTER infantry_bonus;

ALTER TABLE config_positions 
ADD COLUMN archer_bonus DECIMAL(5,2) DEFAULT 0 COMMENT '弓兵加成' 
AFTER cavalry_bonus;

-- 添加索引
ALTER TABLE config_positions 
ADD INDEX idx_rank (position_rank);

-- 验证修改
DESCRIBE config_positions;
