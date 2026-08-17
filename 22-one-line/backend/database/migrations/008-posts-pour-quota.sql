-- Pour Check: two pours per UTC+7 day; still one line.
-- Drop kind-unique so a second pour can insert. Line stays unique via a
-- generated lock (NULL for pours; InnoDB unique allows multiple NULLs).
USE `22_one_line`;

ALTER TABLE `posts`
  DROP INDEX `uk_posts_user_day_kind`,
  ADD COLUMN `line_day_lock` TINYINT
    GENERATED ALWAYS AS (IF(`kind` = 'line', 1, NULL)) STORED
    AFTER `kind`,
  ADD UNIQUE KEY `uk_posts_user_day_line` (`user_id`, `day_key`, `line_day_lock`);
