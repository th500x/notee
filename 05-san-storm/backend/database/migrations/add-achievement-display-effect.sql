-- 成就表：增加 display_effect；移除 v3 废弃列 unlock_title / is_hidden
-- @see docs/20-data-layer/25-2-ACHIEVEMENT_SYSTEM.md §3

ALTER TABLE config_achievements
  ADD COLUMN display_effect VARCHAR(32) NULL COMMENT '大地图立绘显示特效：金色等' AFTER special_effect_desc;

ALTER TABLE config_achievements
  DROP COLUMN unlock_title,
  DROP COLUMN is_hidden;
