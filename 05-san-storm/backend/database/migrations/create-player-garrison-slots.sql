-- 玩家驻守配置表（用于城市防御，异步PVE + 实时PVP守城）
-- 每个玩家最多12组驻守，每组 = 2将领 + 各自装备槽
-- 同时移除废弃的 player_equipment_slots 表

DROP TABLE IF EXISTS player_equipment_slots;

CREATE TABLE IF NOT EXISTS player_garrison (
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  garrison_slot INT NOT NULL COMMENT '驻守槽位编号（1-12）',

  city_id VARCHAR(50) COMMENT '驻守城市ID（如：san_1_city_3_xinye）',
  city_name VARCHAR(50) COMMENT '驻守城市名称（如：新野城）',

  -- 将领1配置
  char1_card VARCHAR(50) COMMENT '将领1卡牌实例ID',
  char1_equipment_card VARCHAR(50) COMMENT '将领1装备卡槽',
  char1_title VARCHAR(50) COMMENT '将领1称号槽',
  char1_achievement VARCHAR(50) COMMENT '将领1成就槽',
  char1_treasure VARCHAR(50) COMMENT '将领1宝物槽',
  char1_troop1 VARCHAR(50) COMMENT '将领1部队槽1',
  char1_troop2 VARCHAR(50) COMMENT '将领1部队槽2',

  -- 将领2配置
  char2_card VARCHAR(50) COMMENT '将领2卡牌实例ID',
  char2_equipment_card VARCHAR(50) COMMENT '将领2装备卡槽',
  char2_title VARCHAR(50) COMMENT '将领2称号槽',
  char2_achievement VARCHAR(50) COMMENT '将领2成就槽',
  char2_treasure VARCHAR(50) COMMENT '将领2宝物槽',
  char2_troop1 VARCHAR(50) COMMENT '将领2部队槽1',
  char2_troop2 VARCHAR(50) COMMENT '将领2部队槽2',

  is_active BOOLEAN DEFAULT FALSE COMMENT '是否已激活（有将领驻守）',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  PRIMARY KEY (player_id, garrison_slot),
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  INDEX idx_city (city_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家驻守配置表';
