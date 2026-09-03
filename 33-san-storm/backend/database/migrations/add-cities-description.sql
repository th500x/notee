-- 城市表：策划 CSV `description` 入库（大地图「城况」面板展示）；可重复执行需自行判断列是否已存在
ALTER TABLE cities
  ADD COLUMN description TEXT NULL COMMENT '城市简介（来自 config_city_template.csv description）' AFTER culture;
