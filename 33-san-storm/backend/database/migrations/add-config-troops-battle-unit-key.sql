-- 战斗序列帧特写：config_troops.battle_unit_key → units/{unitKey}/
-- 空则运行时按 rarity × troop_type 查 battle-unit-key-defaults.json
-- @see docs/00/90-assets/99-2-BATTLE_UNIT_SPRITE_PIPELINE.md §5.3

ALTER TABLE config_troops
  ADD COLUMN battle_unit_key VARCHAR(64) NULL DEFAULT NULL
    COMMENT '战斗序列帧 unitKey 特写；空则走稀有度×兵种默认表'
    AFTER weapon_type;
