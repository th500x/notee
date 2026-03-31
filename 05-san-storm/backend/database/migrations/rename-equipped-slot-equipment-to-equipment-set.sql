-- 将装备卡槽位标识从 equipment 统一为 equipmentSet
-- 注意：仅迁移 equipped_slot 字段值，不影响 card_type='equipment'（装备件）

UPDATE player_cards
SET equipped_slot = 'equipmentSet'
WHERE equipped_slot = 'equipment';
