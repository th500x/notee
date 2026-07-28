-- city_type：仅 city_major / city_medium / city_small / city_gate（无 fort、无裸 gate）
-- city_id 去数字段见：node backend/scripts/migrate-city-id-and-city-gate-db.js
-- 然后再：node backend/database/import-city-geo-data.js

UPDATE cities SET city_type = 'city_gate' WHERE city_type = 'gate';

DELETE FROM cities WHERE city_type = 'fort';

ALTER TABLE cities
  MODIFY COLUMN city_type ENUM(
    'city_major',
    'city_medium',
    'city_small',
    'city_gate'
  ) NOT NULL COMMENT '城市类型（关隘=city_gate；荒郊/集市见 wilderness_enabled/market_enabled）';
