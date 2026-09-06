-- Pet bag on the One Line UUID (docs/00-4 §10.2). One row per user.
-- Individuals live in bag_blob. The claimed-gift ledger stays on stamp_bags.
USE `22_one_line`;

CREATE TABLE IF NOT EXISTS `pet_bags` (
  `user_id` CHAR(36) NOT NULL,
  `bag_blob` TEXT NOT NULL,
  `welcome_claimed` TINYINT(1) NOT NULL DEFAULT 0,
  `tonight_day_key` CHAR(10) NULL,
  `revision` INT UNSIGNED NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
