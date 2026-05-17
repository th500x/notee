-- 一次性：temp_character_ranking_snapshots → temp_character_ranking（缩短表名）
-- 若仍为旧名以外的状态，由 apply-pending-local-ddl.js 按文件白名单跳过 ER_NO_SUCH_TABLE
-- 升级顺序提示：若旧表缺 created_at，请先执行 add-temp-character-ranking-snapshots-created-at.sql 再执行本文件
RENAME TABLE temp_character_ranking_snapshots TO temp_character_ranking;
