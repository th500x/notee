-- 章节战棋战报：battle_type = 'pve_chapter'
ALTER TABLE battles
  MODIFY COLUMN battle_type ENUM(
    'pvp_field',
    'pvp_siege',
    'pvp_defense',
    'pvp_tactical_duel',
    'pve_campaign',
    'pve_event',
    'pve_siege',
    'pve_bandit',
    'pve_chapter'
  ) NOT NULL COMMENT '战斗类型';
