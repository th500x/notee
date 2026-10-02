-- City Events (notee-go docs/01-26-6): dated public events for the Bar hub's sixth tile.
-- region_id: bkk (table page) | pty (scan page). Day keys are UTC+7 'YYYY-MM-DD';
-- a one-day event has start_day_key = end_day_key.
-- publisher: collector id (tat, t21_pattaya, …) or manual. url = the page the row was read
-- from ('' for manual); a re-read page replaces exactly its own rows. Ended rows are purged.
USE `10_notee_go`;

CREATE TABLE IF NOT EXISTS `city_events` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `region_id` VARCHAR(8) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `start_day_key` CHAR(10) NOT NULL,
  `end_day_key` CHAR(10) NOT NULL,
  `publisher` VARCHAR(40) NOT NULL,
  `url` VARCHAR(512) NOT NULL DEFAULT '',
  `hidden_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_city_events_window` (`end_day_key`, `start_day_key`),
  KEY `idx_city_events_page` (`publisher`, `url`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
