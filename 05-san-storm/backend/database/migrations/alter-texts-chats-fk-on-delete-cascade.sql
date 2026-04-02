-- texts / chats 中指向 players(player_id) 的外键改为 ON DELETE CASCADE
-- 与 01-1-DATABASE_DESIGN.md 行为一致：删玩家/删账号级联时自动清理聊天记录与传书
-- 执行前请备份；可重复执行（已 CASCADE 则跳过）

SET @db = DATABASE();

-- ========== chats.sender_id ==========
SELECT rc.DELETE_RULE INTO @dr
FROM information_schema.REFERENTIAL_CONSTRAINTS rc
INNER JOIN information_schema.KEY_COLUMN_USAGE kcu
  ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
  AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
  AND rc.TABLE_NAME = kcu.TABLE_NAME
WHERE kcu.TABLE_SCHEMA = @db
  AND kcu.TABLE_NAME = 'chats'
  AND kcu.COLUMN_NAME = 'sender_id'
  AND kcu.REFERENCED_TABLE_NAME = 'players'
LIMIT 1;

-- 已是 CASCADE 则跳过；未查到或仍为 RESTRICT/NO ACTION 则重建
SET @need_chats = IF(@dr = 'CASCADE', 0, 1);

SELECT CONSTRAINT_NAME INTO @fk_chats
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'chats'
  AND COLUMN_NAME = 'sender_id'
  AND REFERENCED_TABLE_NAME = 'players'
LIMIT 1;

SET @sql_chats_drop = IF(@need_chats = 1 AND @fk_chats IS NOT NULL,
  CONCAT('ALTER TABLE chats DROP FOREIGN KEY `', @fk_chats, '`'),
  'SELECT 1 AS skip_chats_drop');

PREPARE stmt_chats_drop FROM @sql_chats_drop;
EXECUTE stmt_chats_drop;
DEALLOCATE PREPARE stmt_chats_drop;

-- 仅在刚删掉旧 FK 时添加（避免重复 ADD）
SET @has_named = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'chats' AND CONSTRAINT_NAME = 'fk_chats_sender_players'
);

SET @sql_chats_add = IF(@need_chats = 1 AND @has_named = 0,
  'ALTER TABLE chats ADD CONSTRAINT fk_chats_sender_players FOREIGN KEY (sender_id) REFERENCES players(player_id) ON DELETE CASCADE',
  'SELECT 1 AS skip_chats_add');

PREPARE stmt_chats_add FROM @sql_chats_add;
EXECUTE stmt_chats_add;
DEALLOCATE PREPARE stmt_chats_add;

-- ========== texts.sender_id ==========
SELECT rc.DELETE_RULE INTO @dr2
FROM information_schema.REFERENTIAL_CONSTRAINTS rc
INNER JOIN information_schema.KEY_COLUMN_USAGE kcu
  ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
  AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
  AND rc.TABLE_NAME = kcu.TABLE_NAME
WHERE kcu.TABLE_SCHEMA = @db
  AND kcu.TABLE_NAME = 'texts'
  AND kcu.COLUMN_NAME = 'sender_id'
  AND kcu.REFERENCED_TABLE_NAME = 'players'
LIMIT 1;

SET @need_ts = IF(@dr2 = 'CASCADE', 0, 1);

SELECT CONSTRAINT_NAME INTO @fk_ts
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'texts'
  AND COLUMN_NAME = 'sender_id'
  AND REFERENCED_TABLE_NAME = 'players'
LIMIT 1;

SET @sql_ts_drop = IF(@need_ts = 1 AND @fk_ts IS NOT NULL,
  CONCAT('ALTER TABLE texts DROP FOREIGN KEY `', @fk_ts, '`'),
  'SELECT 1 AS skip_texts_sender_drop');

PREPARE stmt_ts_drop FROM @sql_ts_drop;
EXECUTE stmt_ts_drop;
DEALLOCATE PREPARE stmt_ts_drop;

SET @has_ts = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'texts' AND CONSTRAINT_NAME = 'fk_texts_sender_players'
);

SET @sql_ts_add = IF(@need_ts = 1 AND @has_ts = 0,
  'ALTER TABLE texts ADD CONSTRAINT fk_texts_sender_players FOREIGN KEY (sender_id) REFERENCES players(player_id) ON DELETE CASCADE',
  'SELECT 1 AS skip_texts_sender_add');

PREPARE stmt_ts_add FROM @sql_ts_add;
EXECUTE stmt_ts_add;
DEALLOCATE PREPARE stmt_ts_add;

-- ========== texts.receiver_id（可 NULL；有 FK 时才改）==========
SELECT rc.DELETE_RULE INTO @dr3
FROM information_schema.REFERENTIAL_CONSTRAINTS rc
INNER JOIN information_schema.KEY_COLUMN_USAGE kcu
  ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
  AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
  AND rc.TABLE_NAME = kcu.TABLE_NAME
WHERE kcu.TABLE_SCHEMA = @db
  AND kcu.TABLE_NAME = 'texts'
  AND kcu.COLUMN_NAME = 'receiver_id'
  AND kcu.REFERENCED_TABLE_NAME = 'players'
LIMIT 1;

SET @need_tr = IF(@dr3 = 'CASCADE', 0, 1);

SELECT CONSTRAINT_NAME INTO @fk_tr
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'texts'
  AND COLUMN_NAME = 'receiver_id'
  AND REFERENCED_TABLE_NAME = 'players'
LIMIT 1;

SET @sql_tr_drop = IF(@need_tr = 1 AND @fk_tr IS NOT NULL,
  CONCAT('ALTER TABLE texts DROP FOREIGN KEY `', @fk_tr, '`'),
  'SELECT 1 AS skip_texts_receiver_drop');

PREPARE stmt_tr_drop FROM @sql_tr_drop;
EXECUTE stmt_tr_drop;
DEALLOCATE PREPARE stmt_tr_drop;

SET @has_tr = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'texts' AND CONSTRAINT_NAME = 'fk_texts_receiver_players'
);

SET @sql_tr_add = IF(@need_tr = 1 AND @has_tr = 0,
  'ALTER TABLE texts ADD CONSTRAINT fk_texts_receiver_players FOREIGN KEY (receiver_id) REFERENCES players(player_id) ON DELETE CASCADE',
  'SELECT 1 AS skip_texts_receiver_add');

PREPARE stmt_tr_add FROM @sql_tr_add;
EXECUTE stmt_tr_add;
DEALLOCATE PREPARE stmt_tr_add;
