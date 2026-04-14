-- 按 information_schema 解析 parent_city_id 上的外键真实名称后 DROP（兼容 fk_cities_parent_city 与 cities_ibfk_N 等自命名）。
-- 须以 multipleStatements 一次执行下列多句（见 apply-pending-local-ddl.js）；手工 mysql 客户端亦需允许多语句。
SET @fk_name := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cities'
    AND COLUMN_NAME = 'parent_city_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @drop_sql := IF(
  @fk_name IS NULL,
  'SELECT 1 AS _skip_no_parent_city_fk',
  CONCAT('ALTER TABLE cities DROP FOREIGN KEY `', REPLACE(@fk_name, '`', ''), '`')
);
PREPARE _stmt_drop_parent_fk FROM @drop_sql;
EXECUTE _stmt_drop_parent_fk;
DEALLOCATE PREPARE _stmt_drop_parent_fk;
