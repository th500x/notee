-- 并表：player_garrison + player_lineup_extra → player_lineup_sets
-- scope: garrison | extra；Extra 的 city_id 哨兵为空串 ''
-- 可重复执行：已存在目标表则跳过建表与拷贝逻辑由 apply 脚本控制

CREATE TABLE IF NOT EXISTS player_lineup_sets (
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  lineup_scope ENUM('garrison', 'extra') NOT NULL COMMENT 'garrison=驻地 · extra=上阵Extra',
  city_id VARCHAR(50) NOT NULL COMMENT '驻地=主城ID；extra 固定空串',
  lineup_slot INT NOT NULL COMMENT 'garrison 1-2；extra 1-4',

  city_name VARCHAR(50) NULL COMMENT '驻守城市名称（仅 garrison）',

  char1_card VARCHAR(50) NULL COMMENT '将领1卡牌实例ID',
  char1_equipment_card VARCHAR(50) NULL COMMENT '将领1装备卡槽',
  char1_title VARCHAR(50) NULL COMMENT '将领1称号槽',
  char1_achievement VARCHAR(50) NULL COMMENT '将领1成就槽',
  char1_treasure VARCHAR(50) NULL COMMENT '将领1宝物槽',
  char1_troop1 VARCHAR(50) NULL COMMENT '将领1部队槽1',
  char1_troop2 VARCHAR(50) NULL COMMENT '将领1部队槽2',

  char2_card VARCHAR(50) NULL COMMENT '将领2卡牌实例ID',
  char2_equipment_card VARCHAR(50) NULL COMMENT '将领2装备卡槽',
  char2_title VARCHAR(50) NULL COMMENT '将领2称号槽',
  char2_achievement VARCHAR(50) NULL COMMENT '将领2成就槽',
  char2_treasure VARCHAR(50) NULL COMMENT '将领2宝物槽',
  char2_troop1 VARCHAR(50) NULL COMMENT '将领2部队槽1',
  char2_troop2 VARCHAR(50) NULL COMMENT '将领2部队槽2',

  is_active BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否已激活（仅 garrison 有意义）',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  PRIMARY KEY (player_id, lineup_scope, city_id, lineup_slot),
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  INDEX idx_lineup_sets_city (city_id),
  INDEX idx_lineup_sets_scope_active (lineup_scope, is_active),
  INDEX idx_lineup_sets_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='双将领编组套（驻地/Extra）';
