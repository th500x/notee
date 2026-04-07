-- players.morale、players.on_duty：与 01-1 §3.2.2、seed-system-player-sys1、garrison 查询一致
-- 执行顺序：先本文件，再（若尚未执行）add-players-on-duty-city-id.sql
-- 若某列已存在，对应 ALTER 会报错，可跳过该行

ALTER TABLE players
  ADD COLUMN morale INT NOT NULL DEFAULT 70 COMMENT '当前士气（0-120），战后保持'
  AFTER food;

ALTER TABLE players
  ADD COLUMN on_duty TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否披挂上阵（待战开关）'
  AFTER morale;
