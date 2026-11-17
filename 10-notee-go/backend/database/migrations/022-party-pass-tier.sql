-- Party Pass is a tier, not a yes/no. Ultra is a staff flag, not a Play product.
-- party_marks_total is the cumulative +50 / -50 the app applies into the pet bag.
USE `10_notee_go`;

ALTER TABLE `users`
  MODIFY `party_pass` VARCHAR(8) NOT NULL DEFAULT '';

UPDATE `users` SET `party_pass` = '' WHERE `party_pass` IN ('0', 'false');
UPDATE `users` SET `party_pass` = '99' WHERE `party_pass` = '1';

ALTER TABLE `users`
  ADD COLUMN `party_ultra` TINYINT(1) NOT NULL DEFAULT 0 AFTER `party_pass`,
  ADD COLUMN `party_marks_total` INT NOT NULL DEFAULT 0 AFTER `party_ultra`,
  ADD COLUMN `party_upgrade_open` TINYINT(1) NOT NULL DEFAULT 0 AFTER `party_marks_total`;

CREATE TABLE IF NOT EXISTS `party_purchases` (
  `token_hash` CHAR(64) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `product_id` VARCHAR(32) NOT NULL,
  `origin` VARCHAR(8) NOT NULL,
  `state` VARCHAR(16) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token_hash`),
  KEY `idx_party_purchases_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
