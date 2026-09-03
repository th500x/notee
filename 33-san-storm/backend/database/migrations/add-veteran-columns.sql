-- 老兵系统：为 player_cards 增加终身参战计数与老兵档位/加成字段
-- 仅对 legendary / core 部队卡有业务意义；其余卡种忽略这些列

ALTER TABLE player_cards
  ADD COLUMN lifetime_battle_count INT DEFAULT 0
    COMMENT '终身累计参战场次（与 battle_count 同步递增，但不会被修耐久重置）'
    AFTER bonus_movement,
  ADD COLUMN veteran_tier TINYINT DEFAULT 0
    COMMENT '老兵档位（0=无, 1/2/3=三档）'
    AFTER lifetime_battle_count,
  ADD COLUMN veteran_bonus_pct DECIMAL(4,1) DEFAULT 0
    COMMENT '老兵全属性加成百分比合计（如 5.0 表示 +5%）'
    AFTER veteran_tier;
