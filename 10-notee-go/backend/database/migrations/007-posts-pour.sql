-- Pour Check: one line + one pour per UTC+7 day (soft-delete still occupies that kind's slot).
USE `22_one_line`;

ALTER TABLE `posts`
  ADD COLUMN `kind` VARCHAR(16) NOT NULL DEFAULT 'line' AFTER `user_id`,
  ADD COLUMN `pour` JSON NULL DEFAULT NULL AFTER `body`,
  DROP INDEX `uk_posts_user_day`,
  ADD UNIQUE KEY `uk_posts_user_day_kind` (`user_id`, `day_key`, `kind`);
