-- 一次性：旧表名 faction_bulletin_entries → faction_bulletins（两词表名）
-- 若本地从未建旧表，由 apply-pending-local-ddl.js 按文件白名单跳过 ER_NO_SUCH_TABLE
RENAME TABLE faction_bulletin_entries TO faction_bulletins;
