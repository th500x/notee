-- 势力传奇储备额度（pool 行余额 + 收支 category 累计张数）
ALTER TABLE faction_reserve
  ADD COLUMN troop_legendary INT NOT NULL DEFAULT 0 COMMENT 'pool:部队传奇可抽张数; 其它:累计张数',
  ADD COLUMN character_legendary INT NOT NULL DEFAULT 0 COMMENT 'pool:将领传奇可抽张数; 其它:累计张数';
