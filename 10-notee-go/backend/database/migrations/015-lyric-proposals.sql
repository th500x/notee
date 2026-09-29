-- Operator inbox for Party Catalog title suggestions (Go Tonight 「提议新曲目」).
-- Not a Feed post: no body/kind/pour, no TTL, no public GET.
USE `22_one_line`;

CREATE TABLE IF NOT EXISTS `lyric_proposals` (
  `id` CHAR(36) NOT NULL,
  `batch_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `day_key` CHAR(10) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `artist` VARCHAR(120) NULL DEFAULT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'open',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lyric_proposals_status` (`status`, `created_at`),
  KEY `idx_lyric_proposals_user_day` (`user_id`, `day_key`),
  KEY `idx_lyric_proposals_batch` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
