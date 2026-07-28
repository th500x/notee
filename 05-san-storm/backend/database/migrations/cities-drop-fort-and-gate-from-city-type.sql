-- 收窄 cities.city_type ENUM：仅四型（无 fort / 裸 gate；关隘用 city_gate）
-- 城池数据由 import-city-geo-data 等导入；本文件只改表结构

ALTER TABLE cities
  MODIFY COLUMN city_type ENUM(
    'city_major',
    'city_medium',
    'city_small',
    'city_gate'
  ) NOT NULL COMMENT '城市类型（关隘=city_gate）';
