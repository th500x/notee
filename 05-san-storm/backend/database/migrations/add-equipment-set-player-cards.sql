-- 装备卡（套装）方案 B：player_cards.card_type 增加 equipmentSet；装备件绑定父套装 instance（24-EQUIPMENT_SYSTEM.md）
-- 执行前请备份；与 01-1-DATABASE_DESIGN.md §3.2.3 对齐

ALTER TABLE player_cards
  MODIFY COLUMN card_type ENUM(
    'troop',
    'character',
    'equipment',
    'title',
    'achievement',
    'treasure',
    'equipmentSet'
  ) NOT NULL COMMENT '卡牌类型';

ALTER TABLE player_cards
  ADD COLUMN bound_equipment_set_instance_id VARCHAR(50) NULL
    COMMENT '当前编入的套装卡 instance_id（仅 card_type=equipment；互斥见 24 文档）'
    AFTER equipped_slot;

CREATE INDEX idx_player_bound_set ON player_cards (player_id, bound_equipment_set_instance_id);
