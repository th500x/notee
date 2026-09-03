-- 游戏内历法：锚点时刻的游戏年月日 + 现实小时/游戏日流速
-- 锚点时间优先 season_start_time，否则 opened_at（与 gameTimeService 一致）
-- 若列已存在请跳过对应语句

ALTER TABLE config_servers
  ADD COLUMN game_time_start_year INT NOT NULL DEFAULT 184 COMMENT '锚点时刻的游戏年（如赛季开服日=184年1月1日）',
  ADD COLUMN game_time_start_month INT NOT NULL DEFAULT 1 COMMENT '锚点时刻的游戏月 1-12',
  ADD COLUMN game_time_start_day INT NOT NULL DEFAULT 1 COMMENT '锚点时刻的游戏日 1-30',
  ADD COLUMN game_time_real_hours_per_game_day DECIMAL(10,4) NOT NULL DEFAULT 1.0000 COMMENT '现实多少小时推进1个游戏日；1=1现实小时=1游戏日';
