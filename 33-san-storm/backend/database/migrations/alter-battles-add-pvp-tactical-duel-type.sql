-- PVP 战术对决战报：`battle_type = 'pvp_tactical_duel'`（pvpTacticalSimRunner.saveBattle 写入；17-5 §12）
ALTER TABLE battles
  MODIFY COLUMN battle_type ENUM(
    'pvp_field',
    'pvp_siege',
    'pvp_defense',
    'pvp_tactical_duel',
    'pve_campaign',
    'pve_event',
    'pve_siege',
    'pve_bandit'
  ) NOT NULL COMMENT '战斗类型';
