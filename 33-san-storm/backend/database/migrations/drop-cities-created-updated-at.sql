-- =============================================================================
-- 脚本：drop-cities-created-updated-at.sql
-- 作用：仅删除 cities.created_at、cities.updated_at。
-- 前置：若 npc_garrison 仍为 JSON 数组，须先执行其一（勿混用）：
--   1) 仍存在 created_at/updated_at → wrap-cities-npc-garrison-array-using-row-timestamps.sql
--   2) 已无上述两列 → wrap-cities-npc-garrison-array-ledger-now.sql
-- 后端：须已部署仅识别 { units, ledgerAt } 的 npc_garrison（见 cityService.parseNpcGarrisonStored）。
-- =============================================================================

ALTER TABLE cities
  DROP COLUMN created_at,
  DROP COLUMN updated_at;
