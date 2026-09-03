-- 迁移：调整部队属性顺序
-- 日期：2025-03-13
-- 说明：将部队属性顺序调整为：最大兵力、攻击范围、攻击力、防御力、速度、移动力

USE 05_san_storm;

-- MySQL 不支持直接调整字段顺序，需要重新定义字段位置
ALTER TABLE config_troops
  MODIFY COLUMN max_troops INT NOT NULL COMMENT '最大兵力' AFTER troop_type,
  MODIFY COLUMN attack_range INT NOT NULL COMMENT '攻击范围' AFTER max_troops,
  MODIFY COLUMN attack INT NOT NULL COMMENT '攻击力×10' AFTER attack_range,
  MODIFY COLUMN defense INT NOT NULL COMMENT '防御力×10' AFTER attack,
  MODIFY COLUMN speed INT NOT NULL COMMENT '速度' AFTER defense,
  MODIFY COLUMN movement INT NOT NULL COMMENT '移动力' AFTER speed;

SELECT '✅ 部队属性顺序调整完成' AS status;
