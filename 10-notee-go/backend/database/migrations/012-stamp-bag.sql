-- Stamp bag on the One Line UUID (docs/00-3 §6.2). One row per user.
USE `22_one_line`;

CREATE TABLE IF NOT EXISTS `stamp_bags` (
  `user_id` CHAR(36) NOT NULL,
  `inventory_blob` TEXT NOT NULL,
  `check_in_blob` VARCHAR(512) NULL,
  `welcome_picked` TINYINT(1) NOT NULL DEFAULT 0,
  `gift_claimed_ids` TEXT NULL,
  `revision` INT UNSIGNED NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
