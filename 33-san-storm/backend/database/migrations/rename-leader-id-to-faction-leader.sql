-- 重命名 config_factions 表的 leader_id 字段为 faction_leader
-- 执行时间：2025-01-XX
-- 原因：统一字段命名规范，使用 faction_leader 更清晰

USE 05_san_storm;

-- 重命名字段
ALTER TABLE config_factions 
CHANGE COLUMN leader_id faction_leader VARCHAR(50) COMMENT '势力君主ID（关联将领表）';

-- 验证修改
DESCRIBE config_factions;
