-- 披挂上阵所选城池（全局唯一：玩家同一时间只能待战一座城；人数统计与驻地编组无关）
-- 若列已存在可跳过本文件
ALTER TABLE players
  ADD COLUMN on_duty_city_id VARCHAR(64) NULL DEFAULT NULL
  COMMENT '披挂上阵所选城池 id，与 cities.id 对应'
  AFTER on_duty;
