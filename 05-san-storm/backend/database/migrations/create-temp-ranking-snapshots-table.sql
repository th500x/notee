-- Activity ranking snapshots (see docs/00-base/01-1-DATABASE_DESIGN.md §4.3)
-- Includes frozen_* columns (same as add-temp-ranking-snapshots-frozen-deltas.sql on legacy DBs).
-- Requires: players(player_id) for FK.

CREATE TABLE IF NOT EXISTS `temp_ranking_snapshots` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `event_id` VARCHAR(30) NOT NULL COMMENT 'event id e.g. san_1_info_0001',
  `player_id` VARCHAR(4) NOT NULL COMMENT 'player id',

  `snapshot_battle_score` BIGINT DEFAULT 0,
  `snapshot_events_completed` INT DEFAULT 0,
  `snapshot_reputation` BIGINT DEFAULT 0,
  `snapshot_contribution` BIGINT DEFAULT 0,
  `snapshot_silver` BIGINT DEFAULT 0,
  `snapshot_food` BIGINT DEFAULT 0,

  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME DEFAULT NULL,

  `frozen_at` DATETIME NULL DEFAULT NULL,
  `frozen_delta_battle` INT NULL,
  `frozen_delta_events` INT NULL,
  `frozen_delta_rep_contrib` INT NULL,
  `frozen_delta_silver_food` INT NULL,

  UNIQUE KEY `uk_event_player` (`event_id`, `player_id`),
  KEY `idx_event` (`event_id`),
  KEY `idx_expires` (`expires_at`),
  CONSTRAINT `fk_temp_ranking_snapshots_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
