-- 记录上次变更主城时间，用于 24 小时冷却（首次设置 main_city_id 时一并写入）
ALTER TABLE players
  ADD COLUMN main_city_changed_at DATETIME NULL DEFAULT NULL
  COMMENT '上次设置/更换主城（存卡）时间；首次设置与付费更换均更新'
  AFTER main_city_id;
