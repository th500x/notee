-- 势力开局默认出生城（与 cities.city_id 一致；可为 NULL）
ALTER TABLE config_factions
  ADD COLUMN initial_city_id VARCHAR(80) NULL COMMENT '开局默认出生城 city_id' AFTER faction_leader;
