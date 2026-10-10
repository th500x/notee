-- Account entitlements live on the user row, not on the device.
-- party_pass: 1 after the one-time Party Pass purchase. v1 does not sell it.
-- notee_points: Notee point balance (the paid wallet). Not bar pts, not P-Points.
-- Nothing in the app may write these. A later purchase updates the row.
USE `10_notee_go`;

ALTER TABLE `users`
  ADD COLUMN `party_pass` TINYINT(1) NOT NULL DEFAULT 0 AFTER `avatar_id`,
  ADD COLUMN `notee_points` INT NOT NULL DEFAULT 0 AFTER `party_pass`;
