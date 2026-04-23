-- 匪寨爬塔战报：`battle_type = 'pve_bandit'`（与 `routes/battles.js` 枚举一致）
ALTER TABLE battles
  MODIFY COLUMN battle_type ENUM(
    'pvp_field',
    'pvp_siege',
    'pvp_defense',
    'pve_campaign',
    'pve_event',
    'pve_siege',
    'pve_bandit'
  ) NOT NULL COMMENT '战斗类型';
