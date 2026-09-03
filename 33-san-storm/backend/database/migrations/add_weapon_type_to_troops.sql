-- 添加weapon_type字段到config_troops表
-- 创建日期: 2026-03-11
-- 用途: 支持部队图标的精确显示

ALTER TABLE config_troops 
ADD COLUMN weapon_type VARCHAR(50) DEFAULT NULL COMMENT '武器类型（用于图标显示，如：sword, lance, bow, axe等）'
AFTER troop_type;

-- 为现有数据设置默认值（根据troop_type推断）
-- 武器名需与图片文件名一致：troop_r2_infantry_saber.png
UPDATE config_troops 
SET weapon_type = CASE 
  WHEN troop_type = 'infantry' THEN 'saber'
  WHEN troop_type = 'cavalry' THEN 'lance'
  WHEN troop_type = 'archer' THEN 'bow'
  ELSE NULL
END
WHERE weapon_type IS NULL;
