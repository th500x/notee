-- 01-database-split/70-tables-config §3.3.6：config_bonds 增加 season
-- 执行一次。已有列则勿重复执行。

ALTER TABLE config_bonds ADD COLUMN season VARCHAR(20) NULL COMMENT '赛季ID（从 bond_id 解析，如 san_1）';

UPDATE config_bonds SET season = SUBSTRING_INDEX(bond_id, '_', 2) WHERE season IS NULL OR season = '';

ALTER TABLE config_bonds MODIFY COLUMN season VARCHAR(20) NOT NULL COMMENT '赛季ID（从 bond_id 解析）';

ALTER TABLE config_bonds ADD INDEX idx_season (season);
