-- 为玩家角色表添加战斗相关字段
-- 玩家角色作为可上阵的卡牌，需要和将领卡牌一样的战斗属性

USE 05_san_storm;

-- 添加技能字段
ALTER TABLE players 
ADD COLUMN skill_1 VARCHAR(50) COMMENT '技能1' AFTER luck,
ADD COLUMN skill_2 VARCHAR(50) COMMENT '技能2' AFTER skill_1;

-- 添加战斗属性字段
ALTER TABLE players
ADD COLUMN troop_affinity VARCHAR(50) COMMENT '兵种亲和（如：infantry:5）' AFTER skill_2,
ADD COLUMN trait VARCHAR(50) COMMENT '性格特质类型（brave/reckless/calm/normal/cautious/timid）' AFTER troop_affinity,
ADD COLUMN trait_modifier INT COMMENT '性格特质对应的士气修正值（-5到+8，用于战斗计算）' AFTER trait;

-- 验证字段添加
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = '05_san_storm' 
  AND TABLE_NAME = 'players' 
  AND COLUMN_NAME IN ('skill_1', 'skill_2', 'troop_affinity', 'trait', 'trait_modifier')
ORDER BY ORDINAL_POSITION;
