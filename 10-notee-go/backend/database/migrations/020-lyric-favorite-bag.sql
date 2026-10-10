-- Party Catalog favorites for one One Line UUID (notee-go docs/05 §3.3.2a).
-- One row per user. Song ids only; lyric text stays off this server.
USE `10_notee_go`;

CREATE TABLE IF NOT EXISTS `lyric_favorite_bags` (
  `user_id` CHAR(36) NOT NULL,
  `bag_blob` TEXT NOT NULL,
  `revision` INT UNSIGNED NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
