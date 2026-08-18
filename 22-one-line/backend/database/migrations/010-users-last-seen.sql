-- Heartbeat for silent-account idle sweep. Existing rows get "now" so deploy
-- does not wipe everyone whose created_at is already older than 30 days.
USE `22_one_line`;

ALTER TABLE `users`
  ADD COLUMN `last_seen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `updated_at`,
  ADD KEY `idx_users_silent_idle` (`status`, `login_id`, `last_seen_at`);
