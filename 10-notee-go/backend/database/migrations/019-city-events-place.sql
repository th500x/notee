-- City Events venue (notee-go docs/01-26-6): the place text the app hands to Google Maps.
-- '' = unknown (no map button). Collected rows fill it on their next read; manual rows
-- need it. Re-running is skipped as a duplicate column.
USE `10_notee_go`;

ALTER TABLE `city_events`
  ADD COLUMN `place` VARCHAR(160) NOT NULL DEFAULT '' AFTER `end_day_key`;
