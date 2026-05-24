-- 一次性：statistics → player_statistics（与 player_* 族命名对齐）
-- 若源表不存在（新库已用新名），由 apply-pending-local-ddl.js 按白名单跳过 ER_NO_SUCH_TABLE
RENAME TABLE statistics TO player_statistics;
