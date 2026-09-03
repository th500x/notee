-- 迁移：修正 config_titles 和 config_achievements 表结构
-- 执行时间：2026-04
-- 依据：CSV 为唯一正确数据源

-- ============================================================
-- config_titles：移除冗余字段（season/rarity 从ID解析）
-- ============================================================

ALTER TABLE config_titles
  DROP COLUMN season,
  DROP COLUMN rarity;

-- ============================================================
-- config_achievements：删除重建
-- ============================================================

DROP TABLE IF EXISTS config_achievements;

CREATE TABLE config_achievements (
  achievement_id          VARCHAR(50)  NOT NULL PRIMARY KEY COMMENT '成就ID（如：san_1_achi_2_3001，编码赛季+类目+稀有度）',
  achievement_name        VARCHAR(100) NOT NULL COMMENT '成就名称',
  description             TEXT         COMMENT '描述',

  -- 成就链
  chain_id                VARCHAR(50)  COMMENT '成就链ID（同链成就填相同值，无链为NULL）',
  chain_level             INT          COMMENT '成就链层级（1-5，无链为NULL）',
  unlock_title            VARCHAR(50)  COMMENT '解锁的称号ID（完成成就后解锁对应称号，无则NULL）',

  -- 解锁条件
  unlock_conditions       LONGTEXT     COMMENT '解锁条件 JSON（如：{"win_battles":100}）',
  unlock_conditions_desc  VARCHAR(255) COMMENT '解锁条件中文描述（如：战斗胜利100场）',

  -- 属性加成（×10存储）
  attribute_bonus         LONGTEXT     COMMENT '属性加成 JSON（如：{"combat":50}，表示武力+5.0）',

  -- 特殊效果
  special_effect          TEXT         COMMENT '特殊效果（CSV标记语言字符串，如：daily_silver_bonus:50）',
  special_effect_desc     VARCHAR(255) COMMENT '特殊效果中文描述（如：每日额外银两+50）',

  -- 奖励
  rewards                 LONGTEXT     COMMENT '解锁奖励 JSON（如：{"silver":5000,"contribution":100}）',

  -- 其他
  is_hidden               TINYINT(1)   DEFAULT 0 COMMENT '是否隐藏成就（解锁前不显示）',

  created_at              DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_chain (chain_id, chain_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成就配置表';

-- 验证
DESCRIBE config_titles;
DESCRIBE config_achievements;
