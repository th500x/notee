-- 城市攻城系统：创建 cities 运行时表 + wars 表（简化版，用于小城 PVE 测试）

-- 城市运行时数据表
CREATE TABLE IF NOT EXISTS cities (
  id VARCHAR(50) PRIMARY KEY COMMENT '城市ID（如：san_1_city_3_xinye）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID',
  city_name VARCHAR(100) NOT NULL COMMENT '城市名称',
  city_type ENUM('city_major', 'city_medium', 'city_small', 'gate', 'fort') NOT NULL COMMENT '城市类型',

  -- 所属势力（NULL=中立）
  faction_id VARCHAR(50) DEFAULT NULL COMMENT '所属势力ID（NULL=中立/未占领）',

  -- 地理位置
  region VARCHAR(50) COMMENT '所属地区',
  position_x INT COMMENT '地图X坐标',
  position_y INT COMMENT '地图Y坐标',

  -- 五大属性
  population INT DEFAULT 0 COMMENT '人口',
  commerce INT DEFAULT 0 COMMENT '商业值',
  farming INT DEFAULT 0 COMMENT '农业值',
  military INT DEFAULT 0 COMMENT '军事值',
  culture INT DEFAULT 0 COMMENT '文化值',

  -- 防御
  defense INT DEFAULT 0 COMMENT '防御力',
  garrison_capacity INT DEFAULT 0 COMMENT '驻军所容量',

  -- NPC 守军（JSON：生成的 NPC 部队配置，被消灭后清空）
  npc_garrison JSON COMMENT 'NPC守军配置（部队+将领数组，消灭后设为NULL）',
  npc_garrison_alive INT DEFAULT 0 COMMENT 'NPC守军存活数量',
  npc_max_rarity VARCHAR(20) DEFAULT 'rare' COMMENT 'NPC守军最高稀有度',

  -- 长官
  governor_player_id VARCHAR(4) DEFAULT NULL COMMENT '长官玩家ID',

  -- 状态
  status ENUM('neutral', 'contested', 'owned') DEFAULT 'neutral' COMMENT '城市状态',

  INDEX idx_season (season),
  INDEX idx_faction (faction_id),
  INDEX idx_city_type (city_type),
  INDEX idx_status (status)
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
