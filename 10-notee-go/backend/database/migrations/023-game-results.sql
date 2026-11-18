-- Competitive round stats. Anonymous rows have a null user_id.
-- A leaderboard row is tied to users.id, never to login_id: a short-id rename
-- keeps the same account, and a freed short id can be registered by someone else.
USE `10_notee_go`;

CREATE TABLE IF NOT EXISTS `game_results` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` CHAR(36) NULL,
  `game_id` VARCHAR(32) NOT NULL,
  `role` VARCHAR(8) NOT NULL,
  `outcome` VARCHAR(16) NOT NULL,
  `attempts` INT NOT NULL,
  `elapsed_ms` BIGINT NOT NULL,
  `percentile` INT NOT NULL,
  `penalty` VARCHAR(16) NULL,
  `player_count` INT NOT NULL,
  `flag_id` VARCHAR(8) NULL,
  `gender_id` VARCHAR(16) NOT NULL,
  `recorded_at` BIGINT NOT NULL,
  `nick_name` VARCHAR(10) NULL,
  `install_id` CHAR(36) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_game_results_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
