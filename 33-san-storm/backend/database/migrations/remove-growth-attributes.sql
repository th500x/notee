-- ============================================
-- 删除错误的成长属性字段
-- 创建日期: 2026-03-13
-- 说明: 将领卡没有成长机制，删除 growth_* 字段
-- ============================================

USE 05_san_storm;

-- ============================================
-- 删除 config_characters 表的成长属性字段
-- ============================================

ALTER TABLE config_characters DROP COLUMN IF EXISTS growth_force;
ALTER TABLE config_characters DROP COLUMN IF EXISTS growth_command;
ALTER TABLE config_characters DROP COLUMN IF EXISTS growth_intelligence;

-- ============================================
-- 验证修改结果
-- ============================================

-- 查看 config_characters 表结构
DESCRIBE config_characters;

-- ============================================
-- 完成
-- ============================================
SELECT '成长属性字段已删除！' AS status;
