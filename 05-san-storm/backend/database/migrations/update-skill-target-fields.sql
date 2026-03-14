-- 更新技能表的目标字段设计
-- 执行时间：2025-01-XX
-- 原因：将target_type拆分为target_range和target_count，分离范围和数量概念

USE 05_san_storm;

-- 删除旧的 target_type 字段
ALTER TABLE config_skills 
DROP COLUMN IF EXISTS target_type;

-- 添加新的 target_range 字段
ALTER TABLE config_skills 
ADD COLUMN target_range VARCHAR(20) COMMENT '目标范围（1x1/1x2/1x3/2x2/3x3/4x4/cross/cross_thin/cross_large）' 
AFTER effect_value;

-- 添加新的 target_count 字段
ALTER TABLE config_skills 
ADD COLUMN target_count VARCHAR(20) COMMENT '目标数量（all/1/2/3/random_1/random_2/random_3）' 
AFTER target_range;

-- 验证修改
DESCRIBE config_skills;
