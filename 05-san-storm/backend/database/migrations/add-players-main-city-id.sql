-- 玩家主城（存卡）：存放未上阵备用部队卡的 cities.city_id；创角不写入，默认 NULL；新手指引或长官规则首次写入
-- 与 on_duty_city_id、player_garrison 无强制关联；若列已存在可跳过本文件
ALTER TABLE players
  ADD COLUMN main_city_id VARCHAR(64) NULL DEFAULT NULL
  COMMENT '玩家主城（存卡）cities.city_id；未设置时为 NULL；与披挂 on_duty_city_id、驻地编组无强制关联'
  AFTER on_duty_city_id,
  ADD INDEX idx_players_main_city (main_city_id);
