-- 收窄 cities.city_type：删除 fort 行，gate→city_gate，ENUM 仅四型（无 fort / 裸 gate）

UPDATE cities SET city_type = 'city_gate' WHERE city_type = 'gate';

DELETE FROM cities WHERE city_type = 'fort';

ALTER TABLE cities
  MODIFY COLUMN city_type ENUM(
    'city_major',
    'city_medium',
    'city_small',
    'city_gate'
  ) NOT NULL COMMENT '城市类型（关隘=city_gate；荒郊/集市见 wilderness_enabled/market_enabled）';
