-- =============================================================================
-- 脚本：wrap-cities-npc-garrison-array-using-row-timestamps.sql
-- 作用：把仍为 JSON「纯数组」的 npc_garrison 包成 { "units": [...], "ledgerAt": ... }
-- 条件：仅当 cities 表仍存在列 created_at、updated_at 时执行本脚本。
--       若这两列已不存在，切勿执行本脚本（会报 Unknown column）；请改执行：
--       wrap-cities-npc-garrison-array-ledger-now.sql
-- 顺序：通常在本库删除时间戳列之前执行，与 drop-cities-created-updated-at.sql 配合。
-- =============================================================================

UPDATE cities
SET npc_garrison = JSON_OBJECT(
  'units', npc_garrison,
  'ledgerAt', COALESCE(updated_at, created_at, NOW())
)
WHERE npc_garrison IS NOT NULL
  AND JSON_TYPE(npc_garrison) = 'ARRAY';
