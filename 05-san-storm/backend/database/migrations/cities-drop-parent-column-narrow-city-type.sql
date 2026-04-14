ALTER TABLE cities
  DROP COLUMN parent_city_id,
  MODIFY COLUMN city_type ENUM('city_major', 'city_medium', 'city_small', 'gate', 'fort') NOT NULL COMMENT '城市类型（荒郊/集市为 wilderness_enabled/market_enabled 列，非独立 city_type）';
