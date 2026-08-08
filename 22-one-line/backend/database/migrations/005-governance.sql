-- Phase 4: reports + blocks; mod hide via posts.hidden_at; ban via users.status='banned'.
-- No admin_audit table (v1: operator uses SQL — see docs/MODERATION.md).
USE `22_one_line`;

ALTER TABLE `posts`
  ADD COLUMN `hidden_at` TIMESTAMP NULL DEFAULT NULL AFTER `deleted_at`;

ALTER TABLE `posts`
  ADD KEY `idx_posts_hidden` (`hidden_at`);

CREATE TABLE IF NOT EXISTS `blocks` (
  `blocker_id` CHAR(36) NOT NULL,
  `blocked_id` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`blocker_id`, `blocked_id`),
  KEY `idx_blocks_blocked` (`blocked_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reports` (
  `id` CHAR(36) NOT NULL,
  `post_id` CHAR(36) NOT NULL,
  `reporter_id` CHAR(36) NOT NULL,
  `reason` VARCHAR(32) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'open',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reports_reporter_post` (`reporter_id`, `post_id`),
  KEY `idx_reports_status` (`status`, `created_at`),
  KEY `idx_reports_post` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
