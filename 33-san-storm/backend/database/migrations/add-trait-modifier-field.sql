-- ==========================================
-- 迁移脚本：添加 trait_modifier 字段
-- ==========================================
-- 版本: v1.1
-- 创建日期: 2026-03-14
-- 说明: 将 trait_modifier 从 character_extra JSON 移到独立列
-- ==========================================

USE 05_san_storm;

-- 添加 trait_modifier 字段
ALTER TABLE config_characters 
ADD COLUMN trait_modifier INT COMMENT '特性修正值（士气加成，范围-5到+8）' 
AFTER trait;

-- 更新注释：移除 morale 和 trait_modifier
ALTER TABLE config_characters 
MODIFY COLUMN character_extra JSON COMMENT '额外信息（bonds, biography, description）';
