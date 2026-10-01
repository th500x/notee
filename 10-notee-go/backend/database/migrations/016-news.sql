-- News Notes (notee-go docs/06): RSS headlines per region, collected every 2h (UTC+7).
-- One row per region + URL, stored only while the headline is inside the last 24h.
-- hit_count = 2h slots that still saw it on the region feed inside that window.
-- month_key = UTC+7 month of published_at; the board ranks a month's own headlines.
USE `10_notee_go`;

CREATE TABLE IF NOT EXISTS `news_items` (
  `region_id` VARCHAR(8) NOT NULL,
  `url` VARCHAR(512) NOT NULL,
  `title` VARCHAR(300) NOT NULL,
  `publisher` VARCHAR(40) NOT NULL,
  `published_at` DATETIME NOT NULL,
  `month_key` CHAR(7) NOT NULL,
  `hit_count` INT UNSIGNED NOT NULL DEFAULT 1,
  `last_seen_at` DATETIME NOT NULL,
  PRIMARY KEY (`region_id`, `url`),
  KEY `idx_news_items_latest` (`region_id`, `published_at`),
  KEY `idx_news_items_month` (`month_key`, `region_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Closed-month Top 10 per region. Same shape as monthly_board: written once, never edited.
CREATE TABLE IF NOT EXISTS `news_monthly_board` (
  `month_key` CHAR(7) NOT NULL,
  `region_id` VARCHAR(8) NOT NULL,
  `rank_no` TINYINT UNSIGNED NOT NULL,
  `url` VARCHAR(512) NOT NULL,
  `title` VARCHAR(300) NOT NULL,
  `publisher` VARCHAR(40) NOT NULL,
  `published_at` DATETIME NOT NULL,
  `hit_count` INT UNSIGNED NOT NULL,
  `frozen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`month_key`, `region_id`, `rank_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Marks a month as frozen even when no region had a headline (idempotent jobs).
CREATE TABLE IF NOT EXISTS `news_monthly_board_meta` (
  `month_key` CHAR(7) NOT NULL,
  `item_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `frozen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`month_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
