-- Phase 1: silent accounts (deviceKey → JWT). Profile fields nullable until PATCH /me.
USE `22_one_line`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `device_key_hash` CHAR(64) NULL,
  `nick_name` VARCHAR(10) NULL,
  `flag_id` VARCHAR(16) NULL,
  `gender` VARCHAR(8) NULL,
  `avatar_id` VARCHAR(16) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_device_key_hash` (`device_key_hash`),
  KEY `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
