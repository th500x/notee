-- Phase 0: empty database + migration ledger. Domain tables arrive in Phase 1+.
CREATE DATABASE IF NOT EXISTS `22_one_line`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `22_one_line`;

CREATE TABLE IF NOT EXISTS `_schema_migrations` (
  `id` VARCHAR(128) NOT NULL,
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
