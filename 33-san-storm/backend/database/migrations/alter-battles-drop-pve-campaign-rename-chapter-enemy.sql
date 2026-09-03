-- 2026-08-04：战役归档后清理 battles ENUM
-- 1) 去掉 battle_type.pve_campaign（存量行改写为 pve_chapter 后收窄 ENUM）
-- 2) opponent_type.campaign_enemy → chapter_enemy（须先扩 ENUM，再改写，再收窄）
--
-- 注意：不可在 ENUM 尚未包含 chapter_enemy 时直接 UPDATE 到该值（会 1265 Data truncated）。

UPDATE battles
SET battle_type = 'pve_chapter'
WHERE battle_type = 'pve_campaign';

ALTER TABLE battles
  MODIFY COLUMN battle_type ENUM(
    'pvp_field',
    'pvp_siege',
    'pvp_defense',
    'pvp_tactical_duel',
    'pve_event',
    'pve_siege',
    'pve_bandit',
    'pve_chapter'
  ) NOT NULL COMMENT '战斗类型';

-- 先扩容：同时保留 campaign_enemy 与 chapter_enemy
ALTER TABLE battles
  MODIFY COLUMN opponent_type ENUM(
    'player',
    'campaign_enemy',
    'chapter_enemy',
    'event_enemy'
  ) NOT NULL COMMENT '对手类型';

UPDATE battles
SET opponent_type = 'chapter_enemy'
WHERE opponent_type = 'campaign_enemy';

-- 空串 / 非法值：收窄 ENUM 前须清掉，否则生产严模式下会 1265
UPDATE battles
SET opponent_type = 'event_enemy'
WHERE opponent_type = '' OR opponent_type IS NULL;

-- 再收窄：去掉 campaign_enemy
ALTER TABLE battles
  MODIFY COLUMN opponent_type ENUM(
    'player',
    'chapter_enemy',
    'event_enemy'
  ) NOT NULL COMMENT '对手类型';
