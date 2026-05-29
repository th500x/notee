-- 道路遭遇实例表（01-database-split/60-tables-other §3.2.24；31-6-STRATEGIC_ROAD_MARCH §5）
-- 交战格锁 + 战后 battle_id 回填；battle_type 复用 'pvp_field'。
-- 安全重复执行：CREATE TABLE IF NOT EXISTS。

CREATE TABLE IF NOT EXISTS road_encounters (
  encounter_id VARCHAR(50) PRIMARY KEY COMMENT '道路遭遇实例ID（服务端生成，形如 re_{junId}_{时间戳}_{短随机}）',
  season VARCHAR(50) NOT NULL COMMENT '赛季ID（与 cities.season / config_* 一致，如 san_1）',
  jun_id VARCHAR(64) NOT NULL COMMENT '郡ID，与 config_jun.jun_id、cities.jun_id 口径一致',

  position_x INT NOT NULL COMMENT '道路格大地图逻辑 X（郡内格网 gx，与 merged.json 道路层一致）',
  position_y INT NOT NULL COMMENT '道路格大地图逻辑 Y（郡内格网 gy）',

  attacker_player_id VARCHAR(4) NOT NULL COMMENT '攻击方 player_id（进入格触发遭遇的一方）',
  defender_player_id VARCHAR(4) NOT NULL COMMENT '防守方 player_id（格上原占有方 / 守门方）',
  gatekeeper_player_id VARCHAR(4) NULL COMMENT '守门方 player_id（开战模式持有者；可与 defender 相同）',

  status ENUM('pending', 'fighting', 'resolved', 'cancelled') NOT NULL DEFAULT 'pending'
    COMMENT 'pending=已建实例未开战；fighting=交战锁格中；resolved=已结束；cancelled=作废',

  battle_id VARCHAR(80) NULL COMMENT '战后写入：关联 battles.battle_id（§3.2.17 列宽一致）',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '实例创建时间（触发瞬间）',
  started_at DATETIME NULL COMMENT '进入战斗流程时间',
  ended_at DATETIME NULL COMMENT '战斗结束释放格锁时间',

  FOREIGN KEY (attacker_player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  FOREIGN KEY (defender_player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  FOREIGN KEY (gatekeeper_player_id) REFERENCES players(player_id) ON DELETE SET NULL,

  INDEX idx_road_encounter_cell (season, jun_id, position_x, position_y, status),
  INDEX idx_road_encounter_attacker (attacker_player_id),
  INDEX idx_road_encounter_defender (defender_player_id),
  INDEX idx_road_encounter_battle (battle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='道路遭遇实例表（31-6 §5）';
