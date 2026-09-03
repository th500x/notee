-- 驻地编组按城独立：主键由 (player_id, garrison_slot) 改为 (player_id, city_id, garrison_slot)
-- 执行前须保证 player_garrison.city_id 无 NULL/空串（与业务约定一致）

ALTER TABLE player_garrison
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (player_id, city_id, garrison_slot);

ALTER TABLE player_garrison
  MODIFY city_id VARCHAR(50) NOT NULL COMMENT '驻守城市ID';
