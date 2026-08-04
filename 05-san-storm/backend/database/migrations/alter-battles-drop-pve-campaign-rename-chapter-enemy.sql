-- 2026-08-04：战役归档后清理 battles ENUM
-- 1) 去掉 battle_type.pve_campaign（存量行改写为 pve_chapter 后收窄 ENUM）
-- 2) opponent_type.campaign_enemy → chapter_enemy（章节战棋对手）

UPDATE battles
SET battle_type = 'pve_chapter'
WHERE battle_type = 'pve_campaign';

UPDATE battles
SET opponent_type = 'chapter_enemy'
WHERE opponent_type = 'campaign_enemy';

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

ALTER TABLE battles
  MODIFY COLUMN opponent_type ENUM(
    'player',
    'chapter_enemy',
    'event_enemy'
  ) NOT NULL COMMENT '对手类型';
