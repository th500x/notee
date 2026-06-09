-- config_servers 赛季结算窗口列（赛季结算 Phase 0.1 · 见 19-3 §3.3）
--
-- settlement_window_start / _end：玩家可主动「赛季结算」的时间窗口（通常 _end = 关服时刻）。
-- rollover_target_season：关服后 current_season 要切到的目标赛季（如 san_0_m2）。
-- 列名统一用 settlement_ 前缀，与表 season_settlements 对齐。
--
-- 三条独立 ALTER，登记在 apply-pending-local-ddl.js 的 SPLIT_STATEMENTS，
-- 重复执行时各列若已存在会被逐句按「already applied」跳过（幂等）。

ALTER TABLE config_servers ADD COLUMN settlement_window_start DATETIME NULL DEFAULT NULL AFTER season_end_time;
ALTER TABLE config_servers ADD COLUMN settlement_window_end DATETIME NULL DEFAULT NULL AFTER settlement_window_start;
ALTER TABLE config_servers ADD COLUMN rollover_target_season VARCHAR(50) NULL DEFAULT NULL AFTER settlement_window_end;
