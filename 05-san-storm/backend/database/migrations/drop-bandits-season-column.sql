-- 与 docs/00-base/01-DATABASE_DESIGN.md 文末「匪寨」附.1 对齐：bandits 不存 season（实例归属由 bandit_id / 郡 jun_id 等表达）
-- 仅当表 bandits 且列 season 存在时执行。

ALTER TABLE bandits DROP COLUMN season;
