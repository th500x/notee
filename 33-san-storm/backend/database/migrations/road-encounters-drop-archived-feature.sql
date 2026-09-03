-- 道路同格遭遇战（含来战/守门）已下线：服务、路由、前端与共享工具一并移除（如需追溯查 git 历史）。
-- 战略道路行军（road/move、road/self、players.road_jun_id / road_position_*）不受影响。
--
-- 生产执行顺序：本文件须在 create-road-encounters.sql、add-players-road-state.sql 之后执行。
-- 重复执行：DROP TABLE 用 IF EXISTS；DROP COLUMN 第二次会报 "Can't DROP"，批跑脚本按已应用跳过。

DROP TABLE IF EXISTS road_encounters;

ALTER TABLE players DROP COLUMN road_intercept;
