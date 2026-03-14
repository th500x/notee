-- 重命名 config_positions 表的 reputation_required 字段为 requirement
-- 执行时间：2025-01-XX
-- 原因：简化字段命名，使用更通用的 requirement

USE 05_san_storm;

-- 重命名字段
ALTER TABLE config_positions 
CHANGE COLUMN reputation_required requirement INT NOT NULL COMMENT '所需声望';

-- 验证修改
DESCRIBE config_positions;
