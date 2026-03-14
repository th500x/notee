-- ============================================
-- 属性字段顺序调整迁移脚本
-- 创建日期: 2026-03-13
-- 说明: 将属性字段顺序统一为：运气、勇气、武力、统帅、智力、政治、魅力
-- ============================================

USE 05_san_storm;

-- ============================================
-- 1. 修改 players 表的属性字段顺序
-- ============================================

-- 当前属性字段
ALTER TABLE players MODIFY COLUMN luck INT NOT NULL COMMENT '运气×10' AFTER food;
ALTER TABLE players MODIFY COLUMN courage INT NOT NULL COMMENT '勇气×10' AFTER luck;
ALTER TABLE players MODIFY COLUMN combat INT NOT NULL COMMENT '武力×10' AFTER courage;
ALTER TABLE players MODIFY COLUMN command INT NOT NULL COMMENT '统帅×10' AFTER combat;
ALTER TABLE players MODIFY COLUMN intelligence INT NOT NULL COMMENT '智力×10' AFTER command;
ALTER TABLE players MODIFY COLUMN politics INT NOT NULL COMMENT '政治×10' AFTER intelligence;
ALTER TABLE players MODIFY COLUMN charm INT NOT NULL COMMENT '魅力×10' AFTER politics;

-- 基础属性字段
ALTER TABLE players MODIFY COLUMN base_luck INT NOT NULL COMMENT '基础运气×10' AFTER charm;
ALTER TABLE players MODIFY COLUMN base_courage INT NOT NULL COMMENT '基础勇气×10' AFTER base_luck;
ALTER TABLE players MODIFY COLUMN base_combat INT NOT NULL COMMENT '基础武力×10' AFTER base_courage;
ALTER TABLE players MODIFY COLUMN base_command INT NOT NULL COMMENT '基础统帅×10' AFTER base_combat;
ALTER TABLE players MODIFY COLUMN base_intelligence INT NOT NULL COMMENT '基础智力×10' AFTER base_command;
ALTER TABLE players MODIFY COLUMN base_politics INT NOT NULL COMMENT '基础政治×10' AFTER base_intelligence;
ALTER TABLE players MODIFY COLUMN base_charm INT NOT NULL COMMENT '基础魅力×10' AFTER base_politics;

-- ============================================
-- 2. 修改 config_characters 表的属性字段顺序
-- ============================================

-- 基础属性字段（在rarity之后）
ALTER TABLE config_characters MODIFY COLUMN base_luck INT NOT NULL COMMENT '基础运气×10' AFTER rarity;
ALTER TABLE config_characters MODIFY COLUMN base_courage INT NOT NULL COMMENT '基础勇气×10' AFTER base_luck;
ALTER TABLE config_characters MODIFY COLUMN base_combat INT NOT NULL COMMENT '基础武力×10' AFTER base_courage;
ALTER TABLE config_characters MODIFY COLUMN base_command INT NOT NULL COMMENT '基础统帅×10' AFTER base_combat;
ALTER TABLE config_characters MODIFY COLUMN base_intelligence INT NOT NULL COMMENT '基础智力×10' AFTER base_command;
ALTER TABLE config_characters MODIFY COLUMN base_politics INT NOT NULL COMMENT '基础政治×10' AFTER base_intelligence;
ALTER TABLE config_characters MODIFY COLUMN base_charm INT NOT NULL COMMENT '基础魅力×10' AFTER base_politics;

-- ============================================
-- 验证修改结果
-- ============================================

-- 查看 players 表结构
DESCRIBE players;

-- 查看 config_characters 表结构
DESCRIBE config_characters;

-- ============================================
-- 完成
-- ============================================
SELECT '属性字段顺序调整完成！' AS status;
