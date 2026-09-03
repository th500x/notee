-- 驻地/NPC 攻城客户端战报使用 battle_type = 'pve_siege'；若建表时 ENUM 未包含该值，会导致 POST /api/battles 插入失败且无战报。
-- 披挂 siege-resolve 曾使用 siege_pvp_${warId}_... 作为 battle_id，warId 较长时易超过 VARCHAR(50)。
-- 生产环境请按需执行（可先备份 battles 表）。

ALTER TABLE battles
  MODIFY COLUMN battle_id VARCHAR(80) NOT NULL COMMENT '战斗ID';

ALTER TABLE battles
  MODIFY COLUMN battle_type ENUM(
    'pvp_field',
    'pvp_siege',
    'pvp_defense',
    'pve_campaign',
    'pve_event',
    'pve_siege'
  ) NOT NULL COMMENT '战斗类型';
