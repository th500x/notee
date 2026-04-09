-- 城市攻城系统：cities + wars（与 docs/00-base/01-DATABASE_DESIGN.md §3.2.11 对齐）
-- 依赖：factions、players 已存在（外键）
-- 若库中已有旧版 cities（列/枚举不全），CREATE IF NOT EXISTS 不会升级表结构；须另写 ALTER 或删表重建（仅测试库）。

-- 城市运行时数据表
CREATE TABLE IF NOT EXISTS cities (
  id VARCHAR(50) PRIMARY KEY COMMENT '城市ID（如：san_1_city_3_xinye）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID',
  city_name VARCHAR(100) NOT NULL COMMENT '城市名称（系统默认展示名）',
  city_type ENUM('city_major', 'city_medium', 'city_small', 'gate', 'fort', 'wilderness', 'market') NOT NULL COMMENT '城市类型',

  faction_id VARCHAR(50) NULL COMMENT '所属势力ID（NULL=中立）',

  jun_id VARCHAR(64) NULL COMMENT '郡ID，FK → config_jun.id',
  zhou_id VARCHAR(64) NULL COMMENT '州ID，可冗余自郡',
  parent_city_id VARCHAR(50) NULL COMMENT '荒郊/集市所属主城 cities.id',

  position_x INT NULL COMMENT '大地图逻辑 X',
  position_y INT NULL COMMENT '大地图逻辑 Y',

  population INT NOT NULL DEFAULT 0 COMMENT '人口',
  commerce INT NOT NULL DEFAULT 0 COMMENT '商业值',
  farming INT NOT NULL DEFAULT 0 COMMENT '农业值',
  military INT NOT NULL DEFAULT 0 COMMENT '军事值',
  culture INT NOT NULL DEFAULT 0 COMMENT '文化值',

  special_resource_name VARCHAR(50) NULL COMMENT '特色资源名称',
  special_resource_commerce INT NOT NULL DEFAULT 0 COMMENT '特色资源商业加成',
  special_resource_farming INT NOT NULL DEFAULT 0 COMMENT '特色资源农业加成',

  final_commerce INT NOT NULL DEFAULT 0 COMMENT '最终商业值',
  final_farming INT NOT NULL DEFAULT 0 COMMENT '最终农业值',

  lord_player_id VARCHAR(4) NULL COMMENT '长官玩家ID',
  lord_appointed_at DATETIME NULL COMMENT '长官任命时间',

  defense INT NOT NULL DEFAULT 0 COMMENT '防御力',
  garrison_capacity INT NOT NULL DEFAULT 0 COMMENT '驻军所容量',

  npc_garrison JSON NULL COMMENT 'NPC守军：{ units, ledgerAt }',
  npc_garrison_alive INT NOT NULL DEFAULT 0 COMMENT 'NPC守军存活数量',

  status ENUM('neutral', 'contested', 'owned') NOT NULL DEFAULT 'neutral' COMMENT '城市状态',

  is_capital TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否首都',

  is_buildable TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否预设可建造据点空地',
  build_status ENUM('empty', 'building', 'built') NOT NULL DEFAULT 'empty' COMMENT '据点建造状态',
  built_by_player_id VARCHAR(4) NULL COMMENT '据点建造者',
  built_at DATETIME NULL COMMENT '开始建造时间',
  build_complete_at DATETIME NULL COMMENT '预计建造完成时间',
  custom_name VARCHAR(20) NULL COMMENT '据点自定义名：1～3 汉字，建成后不可改',

  buildings_state JSON NULL COMMENT '城内建筑运行态（主殿/三公/太学等）',

  FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE SET NULL,
  FOREIGN KEY (lord_player_id) REFERENCES players(player_id) ON DELETE SET NULL,
  FOREIGN KEY (built_by_player_id) REFERENCES players(player_id) ON DELETE SET NULL,
  FOREIGN KEY (parent_city_id) REFERENCES cities(id) ON DELETE SET NULL,

  INDEX idx_season (season),
  INDEX idx_faction (faction_id),
  INDEX idx_city_type (city_type),
  INDEX idx_status (status),
  INDEX idx_jun (jun_id),
  INDEX idx_parent_city (parent_city_id),
  INDEX idx_lord (lord_player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='城市运行时数据表';

-- 战事表（势力对抗 / 攻城记录）
CREATE TABLE IF NOT EXISTS wars (
  war_id VARCHAR(50) PRIMARY KEY COMMENT '战事ID',
  war_name VARCHAR(100) NOT NULL COMMENT '战事名称',
  war_type ENUM('siege', 'defense', 'field') NOT NULL COMMENT '战事类型',

  -- 目标城市
  target_city_id VARCHAR(50) NOT NULL COMMENT '目标城市ID',
  target_city_name VARCHAR(50) NOT NULL COMMENT '目标城市名称',

  -- 多势力击杀统计（核心：支持多势力同时攻打中立城市）
  faction_kills JSON COMMENT '各势力击杀统计（如：{"san_1_faction_1001":3,"san_1_faction_2001":1}）',

  -- 状态
  status ENUM('active', 'completed') DEFAULT 'active' COMMENT '战事状态',
  winner_faction_id VARCHAR(50) DEFAULT NULL COMMENT '胜利势力ID',

  -- NPC 守军总数（用于判断是否攻破）
  npc_total INT DEFAULT 0 COMMENT 'NPC守军总数',
  npc_killed INT DEFAULT 0 COMMENT '已被消灭的NPC数量',

  start_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  end_time DATETIME COMMENT '结束时间',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_target_city (target_city_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='战事表';
