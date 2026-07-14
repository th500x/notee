-- 道路遭遇：服务端权威推演快照（守方轮询 / 与 PvpAutoDuelReplay 同源）
ALTER TABLE road_encounters
  ADD COLUMN authoritative_resolution_json LONGTEXT NULL
  COMMENT '道路遭遇服务端推演 JSON（与 siegePvpSkirmish 同源）';
