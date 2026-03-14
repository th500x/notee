-- 迁移：移除将领属性的 base_ 前缀
-- 日期：2025-03-13
-- 说明：将 base_luck, base_courage 等改为 luck, courage 等

USE 05_san_storm;

-- 重命名将领属性字段
ALTER TABLE config_characters
  CHANGE COLUMN base_luck luck INT NOT NULL COMMENT '运气×10',
  CHANGE COLUMN base_courage courage INT NOT NULL COMMENT '勇气×10',
  CHANGE COLUMN base_combat combat INT NOT NULL COMMENT '武力×10',
  CHANGE COLUMN base_command command INT NOT NULL COMMENT '统帅×10',
  CHANGE COLUMN base_intelligence intelligence INT NOT NULL COMMENT '智力×10',
  CHANGE COLUMN base_politics politics INT NOT NULL COMMENT '政治×10',
  CHANGE COLUMN base_charm charm INT NOT NULL COMMENT '魅力×10';

SELECT '✅ 将领属性字段重命名完成' AS status;
