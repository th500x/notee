-- Phase 5: monthly Top-30 snapshot (UTC+7 month_key). Board reads snapshot; TTL soft-deletes expired posts.
USE `22_one_line`;

CREATE TABLE IF NOT EXISTS `monthly_board` (
  `month_key` CHAR(7) NOT NULL,
  `rank_no` TINYINT UNSIGNED NOT NULL,
  `post_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `body` VARCHAR(400) NOT NULL,
  `nick_name` VARCHAR(10) NULL,
  `flag_id` VARCHAR(16) NOT NULL,
  `stamp_id` VARCHAR(64) NULL,
  `resonance_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `posted_at` DATETIME NOT NULL,
  `frozen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`month_key`, `rank_no`),
  UNIQUE KEY `uk_monthly_board_month_post` (`month_key`, `post_id`),
  KEY `idx_monthly_board_post` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Marks a month as frozen even when Top-30 is empty (idempotent jobs).
CREATE TABLE IF NOT EXISTS `monthly_board_meta` (
  `month_key` CHAR(7) NOT NULL,
  `item_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `frozen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`month_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
