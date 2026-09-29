-- Pour Check bag on the One Line UUID (docs/03 §3.7). One row per user.
-- Ledger + last 30 photo-less history records. Originals never leave the device.
USE `22_one_line`;

CREATE TABLE IF NOT EXISTS `pour_bags` (
  `user_id` CHAR(36) NOT NULL,
  `ledger_blob` TEXT NOT NULL,
  `history_blob` MEDIUMTEXT NOT NULL,
  `keep_last_30` TINYINT(1) NOT NULL DEFAULT 1,
  `revision` INT UNSIGNED NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
