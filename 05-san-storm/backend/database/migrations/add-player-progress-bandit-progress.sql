-- 匪寨进度与 `campaign_progress` 并列：统一落在 player_progress，避免额外表。
-- 键结构草案见 docs/00-base/01-DATABASE_DESIGN.md 文末「匪寨系统相关表」§附.2
-- 若列已存在会报错，可忽略或先查 INFORMATION_SCHEMA.COLUMNS

ALTER TABLE player_progress
  ADD COLUMN bandit_progress JSON NULL COMMENT '匪寨：按 bandit_id 存 nextLayer / attemptsUsed / quotaDate 等';
