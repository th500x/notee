-- Gift inbox: campaigns + per-user claims. Product: notee-go docs/00-2 §3.5
USE `22_one_line`;

CREATE TABLE IF NOT EXISTS `gift_campaigns` (
  `id` CHAR(36) NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `payload` JSON NOT NULL,
  `audience` VARCHAR(16) NOT NULL,
  `require_login_id` TINYINT(1) NOT NULL DEFAULT 0,
  `starts_at` TIMESTAMP NULL DEFAULT NULL,
  `ends_at` TIMESTAMP NULL DEFAULT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'active',
  `note` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gift_campaigns_status` (`status`, `audience`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gift_campaign_targets` (
  `campaign_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `login_id` CHAR(4) NOT NULL,
  PRIMARY KEY (`campaign_id`, `user_id`),
  KEY `idx_gift_targets_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gift_claims` (
  `campaign_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `payload_snapshot` JSON NOT NULL,
  `claimed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`campaign_id`, `user_id`),
  KEY `idx_gift_claims_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
