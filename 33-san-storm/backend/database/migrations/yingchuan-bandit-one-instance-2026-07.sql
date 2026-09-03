-- 颍川匪寨收口为一寨（13-8）：删除第二实例行。
-- 个人进度 JSON 合并见 scripts/migrate-yingchuan-bandit-one-instance.js

DELETE FROM bandits WHERE bandit_id = 'san_1_bandit_2_yingchuan';
