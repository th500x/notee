-- 系统占位账号 sys1：供 texts.sender_id 外键使用；不可登录（auth 须拒绝 id=sys1）
-- 密码哈希对应明文 __SYS1_NO_LOGIN__（bcrypt）；勿改作真实账号
-- 执行前请确认库名；推荐与 Node 脚本二选一（脚本会从现有玩家复制势力）
--
-- mysql -h HOST -P 3306 -u USER -p DATABASE < seed-system-player-sys1.sql

SELECT COALESCE(
  (SELECT faction_id FROM players WHERE player_id <> 'sys1' LIMIT 1),
  'san_1_faction_1001'
) INTO @sys_faction_id;

SELECT COALESCE(
  (SELECT faction_name FROM players WHERE player_id <> 'sys1' LIMIT 1),
  '系统占位'
) INTO @sys_faction_name;

INSERT INTO accounts (id, password, birthMonth, serverId, account_type, clientIP, machineId, status)
VALUES (
  'sys1',
  '$2b$10$JT/6M7V/.DU3uMdO9w9YNuxLPUgb3CcmccglL/p..h6BlnaKxK7/y',
  1,
  'SYS0',
  'real',
  '240.0.0.254',
  'san-storm-sys1-machine-placeholder-v1',
  'inactive'
)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO players (
  player_id, character_name, faction_id, faction_name, avatar,
  combat, intelligence, command, politics, charm, courage, luck,
  skill_1, skill_2, current_position_id, current_position_name, position_level,
  reputation, reputation_to_next, silver, food, morale, on_duty,
  last_login_at, last_active_at
) VALUES (
  'sys1', '【系统】', @sys_faction_id, @sys_faction_name, NULL,
  50, 50, 50, 50, 50, 50, 50,
  NULL, NULL, NULL, NULL, 8,
  0, 10, 0, 0, 70, 0,
  NOW(), NOW()
)
ON DUPLICATE KEY UPDATE player_id = player_id;

INSERT INTO player_progress (player_id, tutorial_completed, tutorial_current_step)
VALUES ('sys1', FALSE, 1)
ON DUPLICATE KEY UPDATE player_id = player_id;

INSERT INTO player_events (player_id)
VALUES ('sys1')
ON DUPLICATE KEY UPDATE player_id = player_id;

INSERT INTO statistics (player_id)
VALUES ('sys1')
ON DUPLICATE KEY UPDATE player_id = player_id;
