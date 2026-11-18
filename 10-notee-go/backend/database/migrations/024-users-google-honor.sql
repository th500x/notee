-- Google sign-in key and the one-time honor rename (notee-go docs/00-core/00-1-Account.md §4–§5).
-- google_sub: Google's stable account id from a verified ID token. One Notee account per Google
--   account; soft delete clears it. ASCII keeps the unique index short.
-- honor_renamed_at: set by the one rename and never cleared, so the rename stays once per account.
-- regular_login_id: the letter id held before the rename, tried first when a refund takes the
--   digit id back. Not unique: the letter id is back in the pool and someone may claim it.
USE `10_notee_go`;

ALTER TABLE `users`
  ADD COLUMN `google_sub` VARCHAR(255) CHARACTER SET ascii NULL AFTER `password_hash`,
  ADD COLUMN `honor_renamed_at` DATETIME NULL AFTER `google_sub`,
  ADD COLUMN `regular_login_id` CHAR(4) NULL AFTER `honor_renamed_at`,
  ADD UNIQUE KEY `uk_users_google_sub` (`google_sub`);
