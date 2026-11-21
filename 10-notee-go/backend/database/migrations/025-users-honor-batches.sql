-- The honor rename's two batches stay on the account until the rename succeeds.
-- Closing the dialog must not draw a new set (notee-go docs/00-core/00-1-Account.md §5).
-- Each value is comma-separated digit ids, at most nine. NULL means that batch was never drawn.
USE `10_notee_go`;

ALTER TABLE `users`
  ADD COLUMN `honor_batch_1` VARCHAR(80) NULL AFTER `regular_login_id`,
  ADD COLUMN `honor_batch_2` VARCHAR(80) NULL AFTER `honor_batch_1`;
