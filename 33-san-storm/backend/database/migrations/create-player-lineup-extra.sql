-- 上阵编组 Extra（玩法2 预设）· slot 1–4 = A–D
-- 无玩家行；字段对齐 player_garrison 的 char1/char2 引用列；无 city_id

CREATE TABLE IF NOT EXISTS player_lineup_extra (
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  lineup_slot INT NOT NULL COMMENT '额外上阵槽位（1=A … 4=D）',

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

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  PRIMARY KEY (player_id, lineup_slot),
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  INDEX idx_lineup_extra_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='上阵编组 Extra（玩法2 · A–D）';
