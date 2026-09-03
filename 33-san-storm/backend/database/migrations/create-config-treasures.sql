CREATE TABLE IF NOT EXISTS config_treasures (
  treasure_id VARCHAR(64) NOT NULL PRIMARY KEY,
  season VARCHAR(20) NOT NULL,
  treasure_name VARCHAR(100) NOT NULL,
  series VARCHAR(64) NULL,
  luck_bonus INT NOT NULL DEFAULT 0,
  courage_bonus INT NOT NULL DEFAULT 0,
  combat_bonus INT NOT NULL DEFAULT 0,
  command_bonus INT NOT NULL DEFAULT 0,
  intelligence_bonus INT NOT NULL DEFAULT 0,
  politics_bonus INT NOT NULL DEFAULT 0,
  charm_bonus INT NOT NULL DEFAULT 0,
  special_effect JSON NULL,
  special_effect_desc VARCHAR(255) NULL,
  description TEXT NULL,
  INDEX idx_config_treasures_season (season),
  INDEX idx_config_treasures_series (series)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
