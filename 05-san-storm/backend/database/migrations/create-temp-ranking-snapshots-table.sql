-- Event ranking snapshots (activity + king dasikong daily; see docs §4.3 temp_event_ranking)
-- Includes frozen_* columns (same as add-temp-ranking-snapshots-frozen-deltas.sql on legacy DBs).
-- Requires: players(player_id) for FK.
-- Legacy DBs: run rename-temp-ranking-snapshots-to-temp-event-ranking.sql after incremental alters.

CREATE TABLE IF NOT EXISTS `temp_event_ranking` (
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
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'row last modified',
  `expires_at` DATETIME DEFAULT NULL,

  `frozen_at` DATETIME NULL DEFAULT NULL,
  `frozen_delta_battle` INT NULL,
  `frozen_delta_events` INT NULL,
  `frozen_delta_reputation` INT NULL COMMENT '冻结：声望 earned 增量',
  `frozen_delta_contribution` INT NULL COMMENT '冻结：贡献 earned 增量',
  `frozen_delta_silver_food` INT NULL COMMENT '已废弃，计分不再使用',

  UNIQUE KEY `uk_event_player` (`event_id`, `player_id`),
  KEY `idx_event` (`event_id`),
  KEY `idx_expires` (`expires_at`),
  CONSTRAINT `fk_temp_event_ranking_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
