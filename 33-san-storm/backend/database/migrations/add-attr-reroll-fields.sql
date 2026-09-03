-- ============================================
-- 迁移脚本：为 players 表添加属性随机字段
-- 创建日期: 2026-03-27
-- 说明: 支持玩家角色属性重随机功能（每日2次，消耗银两）
-- ============================================

USE 05_san_storm;

-- 添加属性随机相关字段
ALTER TABLE players
  ADD COLUMN attr_reroll_date DATE COMMENT '上次属性随机日期（用于每日次数重置）' AFTER trait_modifier,
  ADD COLUMN attr_reroll_count INT DEFAULT 0 COMMENT '今日已随机次数（每日00:00重置，上限2）' AFTER attr_reroll_date,
  ADD COLUMN attr_reroll_batches JSON COMMENT '属性随机历史批次（与角色创建random_batches格式一致）' AFTER attr_reroll_count,
  ADD COLUMN attr_reroll_selected_batch INT COMMENT '当前选中的方案所在批次' AFTER attr_reroll_batches,
  ADD COLUMN attr_reroll_selected_index INT COMMENT '当前选中的方案索引（0-2）' AFTER attr_reroll_selected_batch;

-- 验证字段添加
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = '05_san_storm' 
  AND TABLE_NAME = 'players' 
  AND COLUMN_NAME LIKE 'attr_reroll_%'
ORDER BY ORDINAL_POSITION;

SELECT '✅ 迁移完成：属性随机字段已添加到 players 表' AS status;
