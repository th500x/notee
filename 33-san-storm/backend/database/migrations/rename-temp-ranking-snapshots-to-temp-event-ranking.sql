-- 一次性：temp_ranking_snapshots → temp_event_ranking（活动榜 + 大司空日榜共用；缩短表名）
-- 若源表不存在，由 apply-pending-local-ddl.js 按白名单跳过 ER_NO_SUCH_TABLE
RENAME TABLE temp_ranking_snapshots TO temp_event_ranking;
