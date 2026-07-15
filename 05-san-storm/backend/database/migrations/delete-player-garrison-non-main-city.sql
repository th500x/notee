-- 驻地编组仅挂主城：删除非主城（或玩家尚未设主城）的 player_garrison 行。
-- 本地测试数据清理；换主城时运行时由 playerMainCityService → relocateGarrisonToMainCity 迁移。

DELETE pg
FROM player_garrison pg
LEFT JOIN players p ON p.player_id = pg.player_id
WHERE p.player_id IS NULL
   OR p.main_city_id IS NULL
   OR TRIM(CAST(p.main_city_id AS CHAR)) = ''
   OR pg.city_id <> p.main_city_id;
