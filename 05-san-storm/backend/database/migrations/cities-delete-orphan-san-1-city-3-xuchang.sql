-- 数据整理：删除幽灵城 san_1_city_3_xuchang（不在 config_city_template.csv / cities_seed / merged 地图；
-- 与正式城 san_1_city_2_xuchang 同占格 24,17，导致寻路/立足格歧义）。
-- 幂等：引用改写与 DELETE 无匹配行时影响 0 行。

UPDATE wars_pvp
   SET target_city_id = 'san_1_city_2_xuchang'
 WHERE target_city_id = 'san_1_city_3_xuchang';

UPDATE players
   SET main_city_id = 'san_1_city_2_xuchang'
 WHERE main_city_id = 'san_1_city_3_xuchang';

UPDATE players
   SET on_duty_city_id = 'san_1_city_2_xuchang'
 WHERE on_duty_city_id = 'san_1_city_3_xuchang';

UPDATE player_garrison
   SET city_id = 'san_1_city_2_xuchang'
 WHERE city_id = 'san_1_city_3_xuchang';

UPDATE faction_bulletins
   SET target_city_id = 'san_1_city_2_xuchang'
 WHERE target_city_id = 'san_1_city_3_xuchang';

DELETE FROM cities WHERE city_id = 'san_1_city_3_xuchang';

-- 本地测试号 0DOQ：郡/坐标错位（颍川 0,0 实为无效立足）→ 颍川遭遇战常用路格 (9,1)
UPDATE players
   SET road_jun_id = 'san_1_jun_yingchuan',
       road_position_x = 9,
       road_position_y = 1,
       road_client_notice = NULL,
       road_updated_at = NOW()
 WHERE player_id = '0DOQ';
