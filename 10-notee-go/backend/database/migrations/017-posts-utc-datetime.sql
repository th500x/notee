-- posts times the service writes hold UTC wall time (toMysqlDateTimeUtc / UTC_TIMESTAMP()).
-- As TIMESTAMP they were re-zoned by the session; DATETIME keeps the wall value as written,
-- same as expires_at and news_items. The conversion reads each value in the session zone it
-- was written under (server default; do not SET time_zone). updated_at stays TIMESTAMP
-- (MySQL-maintained). Re-running is a no-op.
USE `10_notee_go`;

ALTER TABLE `posts`
  MODIFY COLUMN `created_at` DATETIME NOT NULL,
  MODIFY COLUMN `deleted_at` DATETIME NULL DEFAULT NULL,
  MODIFY COLUMN `hidden_at` DATETIME NULL DEFAULT NULL;
