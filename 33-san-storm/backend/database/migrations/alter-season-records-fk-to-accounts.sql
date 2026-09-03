-- season_records 外键改向 accounts（赛季继承 Phase 0.0 · 见 19-3 §5.2）
--
-- 背景：现表外键 season_records_ibfk_1 为 player_id -> players(player_id) ON DELETE CASCADE。
-- 赛季 rollover 会删除全部真人 players 行，会连带级联删掉本表的历史成绩。
-- 改为指向 accounts(id)（账号永不随赛季删除；player_id == accounts.id，语义一致）。
--
-- 幂等：重复执行安全（仅在旧约束存在时 DROP，仅在新约束不存在时 ADD）。
-- 需要 multipleStatements（PREPARE/EXECUTE）—— 已登记在 apply-pending-local-ddl.js。

SET @drop_old := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'season_records'
      AND constraint_name = 'season_records_ibfk_1'
      AND constraint_type = 'FOREIGN KEY'
  ),
  'ALTER TABLE season_records DROP FOREIGN KEY season_records_ibfk_1',
  'DO 0'
));
PREPARE stmt_drop_old FROM @drop_old;
EXECUTE stmt_drop_old;
DEALLOCATE PREPARE stmt_drop_old;

SET @add_new := (SELECT IF(
  EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'season_records'
      AND constraint_name = 'fk_season_records_account'
      AND constraint_type = 'FOREIGN KEY'
  ),
  'DO 0',
  'ALTER TABLE season_records ADD CONSTRAINT fk_season_records_account FOREIGN KEY (player_id) REFERENCES accounts(id) ON DELETE CASCADE'
));
PREPARE stmt_add_new FROM @add_new;
EXECUTE stmt_add_new;
DEALLOCATE PREPARE stmt_add_new;
