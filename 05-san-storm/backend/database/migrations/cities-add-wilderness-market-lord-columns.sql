ALTER TABLE cities
  ADD COLUMN wilderness_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '荒郊探索能力（与种子 wildernessEnabled 一致）' AFTER zhou_id,
  ADD COLUMN market_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '集市探索能力（与种子 marketEnabled 一致）' AFTER wilderness_enabled,
  ADD COLUMN initial_lord_character_id VARCHAR(64) NULL COMMENT '开服种子默认长官将领 id（config_characters）' AFTER market_enabled;
