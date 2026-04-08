-- =============================================================================
-- 脚本：wrap-cities-npc-garrison-array-ledger-now.sql
-- 作用：把仍为 JSON「纯数组」的 npc_garrison 包成 { "units": [...], "ledgerAt": NOW() }
-- 条件：当 cities.created_at / cities.updated_at 已不存在（或从未存在），无法用行时间戳
--       作为 ledgerAt 种子时使用本脚本。与上一脚本二选一，勿重复执行「包一层」逻辑。
-- 注意：ledgerAt 用当前时刻，补满锚点与「原 updated_at」可能略有偏差；无历史列时只能如此。
-- =============================================================================

UPDATE cities
SET npc_garrison = JSON_OBJECT(
  'units', npc_garrison,
  'ledgerAt', NOW()
)
WHERE npc_garrison IS NOT NULL
  AND JSON_TYPE(npc_garrison) = 'ARRAY';
