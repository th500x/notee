-- 道路：守方门闸退让等一次性客户端提示（GET …/road/self 读后置空）
ALTER TABLE players
  ADD COLUMN road_client_notice VARCHAR(512) NULL DEFAULT NULL
  COMMENT '道路客户端一次性提示（读 road/self 后清空）'
  AFTER road_last_request_id;
