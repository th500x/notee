-- player_progress.campaign_progress：战役进度 JSON（见 01-1 §3.2.6.1）
-- 生产若已含该列，勿重复执行；本地库若较旧无此列，执行本脚本即可与生产对齐。
-- 若列已存在，执行会报错，可忽略或先查 INFORMATION_SCHEMA.COLUMNS

ALTER TABLE player_progress
  ADD COLUMN campaign_progress JSON NULL COMMENT '战役地图进度，键为 campaign_id';
