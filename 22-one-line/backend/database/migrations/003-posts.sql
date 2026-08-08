-- Phase 2: one post per user per UTC+7 day. Soft-delete keeps the day slot.
USE `22_one_line`;

CREATE TABLE IF NOT EXISTS `posts` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `body` VARCHAR(400) NOT NULL,
  `flag_id` VARCHAR(16) NOT NULL,
  `stamp_id` VARCHAR(64) NULL DEFAULT NULL,
  `resonance_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `edit_used` TINYINT(1) NOT NULL DEFAULT 0,
  `day_key` CHAR(10) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_posts_user_day` (`user_id`, `day_key`),
  KEY `idx_posts_feed` (`deleted_at`, `expires_at`, `created_at`, `id`),
  KEY `idx_posts_flag_feed` (`flag_id`, `deleted_at`, `expires_at`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
