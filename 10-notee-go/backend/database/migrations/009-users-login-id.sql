-- Explicit sign-in: 4-char login id + bcrypt password, bound to the existing silent UUID.
-- Both stay NULL for silent accounts; soft delete clears them so the id returns to the pool
-- (InnoDB unique allows multiple NULLs).
USE `22_one_line`;

ALTER TABLE `users`
  ADD COLUMN `login_id` CHAR(4) NULL AFTER `device_key_hash`,
  ADD COLUMN `password_hash` CHAR(60) NULL AFTER `login_id`,
  ADD UNIQUE KEY `uk_users_login_id` (`login_id`);
