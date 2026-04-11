-- 迁移：cities 主键 id → city_id；garrison_capacity → player_garrison_capacity（与 01 / 策划 CSV 对齐）
-- 在已存在旧版 cities（由 add-city-siege-tables.sql 创建）的库上执行一次。
-- 若已是新列名，请跳过本文件（会报错）。
-- 极旧库若无 parent_city_id 列，第 3 步不添加自引用外键（待补列后再执行带 FK 的补丁迁移）。

-- 1) 删除自引用外键（约束名因环境而异，从 information_schema 解析）
SET @fk := (
  SELECT kcu.CONSTRAINT_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  INNER JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
    AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND kcu.TABLE_NAME = rc.TABLE_NAME
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
    AND kcu.TABLE_NAME = 'cities'
    AND kcu.COLUMN_NAME = 'parent_city_id'
    AND kcu.REFERENCED_TABLE_NAME = 'cities'
  LIMIT 1
);
SET @sql := IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE cities DROP FOREIGN KEY `', @fk, '`'));
PREPARE _dropfk FROM @sql;
EXECUTE _dropfk;
DEALLOCATE PREPARE _dropfk;

-- 2) 重命名列
ALTER TABLE cities
  CHANGE COLUMN `id` `city_id` VARCHAR(50) NOT NULL COMMENT '城市ID；与策划 CSV city_id 同名列';

ALTER TABLE cities
  CHANGE COLUMN `garrison_capacity` `player_garrison_capacity` INT NOT NULL DEFAULT 0
  COMMENT '城内驻军所容量（玩家侧编组/守城槽位规模）';

-- 3) 恢复自引用外键（仅当已存在 parent_city_id 列；极旧库无该列时跳过，待 add-city-siege 等补丁列后再补）
SET @has_parent_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cities'
    AND COLUMN_NAME = 'parent_city_id'
);
SET @sql_parent_fk := IF(
  @has_parent_col > 0,
  'ALTER TABLE cities ADD CONSTRAINT fk_cities_parent_city FOREIGN KEY (parent_city_id) REFERENCES cities(city_id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE _add_parent_fk FROM @sql_parent_fk;
EXECUTE _add_parent_fk;
DEALLOCATE PREPARE _add_parent_fk;
