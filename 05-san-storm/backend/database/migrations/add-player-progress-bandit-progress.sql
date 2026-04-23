-- 匪寨玩家进度与 campaign_progress 并列：player_progress.bandit_progress（JSON）。
-- 键约定见 docs/00-base/01-DATABASE_DESIGN.md §3.2.6.2（byBanditMapObjectId / nextLayer / raid）。
-- 列已存在时 apply-pending-local-ddl.js 会 SKIP Duplicate column。

ALTER TABLE player_progress
  ADD COLUMN bandit_progress JSON NULL COMMENT '匪寨进度 JSON：byBanditMapObjectId';
