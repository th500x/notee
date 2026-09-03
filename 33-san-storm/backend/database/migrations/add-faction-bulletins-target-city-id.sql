-- 势力公告 · 战事行：关联目标城（供前端「点击城名定位大地图」）
ALTER TABLE faction_bulletins
  ADD COLUMN target_city_id VARCHAR(64) NULL DEFAULT NULL
    COMMENT '战事相关目标 city_id；非战事行可为 NULL'
    AFTER body;

ALTER TABLE faction_bulletins
  ADD KEY idx_faction_target_city (faction_id, target_city_id, id);
