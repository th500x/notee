-- Phase 3: one resonance per (post, user). Count cached on posts.resonance_count.
USE `22_one_line`;

CREATE TABLE IF NOT EXISTS `resonances` (
  `post_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`post_id`, `user_id`),
  KEY `idx_resonances_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
