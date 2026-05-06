-- 为 config_skills 表添加 target_type 和 troop_type 字段
-- 执行时间：2025-01-XX
-- 原因：补充技能表缺失的字段，完善技能配置

USE 05_san_storm;

-- 添加 troop_type 字段（在 character_type 之后）
ALTER TABLE config_skills 
ADD COLUMN troop_type VARCHAR(100) COMMENT '兵种类型限制（如：infantry;cavalry;archer，留空表示通用）' 
AFTER character_type;

-- 添加 target_type 字段（在 effect_value 之后）
ALTER TABLE config_skills 
ADD COLUMN target_type VARCHAR(50) COMMENT '目标类型（single/cross/square/line/self/ally_single/ally_line/ally_square/random 等；历史曾用 line_horizontal/ally_area/random_enemies）' 
AFTER effect_value;

-- 验证修改
DESCRIBE config_skills;
