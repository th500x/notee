-- ==========================================
-- 迁移脚本：添加将领表新字段
-- ==========================================
-- 版本: v1.0
-- 创建日期: 2026-03-14
-- 说明: 为config_characters表添加新字段
-- ==========================================

USE 05_san_storm;

-- 添加新字段
ALTER TABLE config_characters
  ADD COLUMN courtesy_name VARCHAR(50) COMMENT '字（如：玄德）' AFTER character_name,
  ADD COLUMN faction VARCHAR(50) COMMENT '势力（如：刘备、曹操）' AFTER rarity,
  ADD COLUMN birth_year INT COMMENT '出生年（如：161）' AFTER charm,
  ADD COLUMN death_year INT COMMENT '卒年（如：223）' AFTER birth_year,
  ADD COLUMN stage VARCHAR(20) COMMENT '生涯（early/middle/late）' AFTER death_year,
  ADD COLUMN character_type VARCHAR(20) COMMENT '将领类型（military/strategist/balanced）' AFTER stage,
  ADD COLUMN character_extra JSON COMMENT '额外信息（trait_modifier, morale, bonds, biography, description）' AFTER trait;

-- 添加新索引
ALTER TABLE config_characters
  ADD INDEX idx_faction (faction),
  ADD INDEX idx_stage (stage),
  ADD INDEX idx_character_type (character_type);

-- 验证表结构
DESCRIBE config_characters;

SELECT '✅ 迁移完成：将领表新字段已添加' AS status;
