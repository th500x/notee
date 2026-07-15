-- 真三日报 · 势力战事目标日投票（32-6 / 17-3）
CREATE TABLE IF NOT EXISTS faction_war_daily_polls (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  faction_id VARCHAR(64) NOT NULL,
  poll_date DATE NOT NULL,
  season VARCHAR(32) NOT NULL DEFAULT 'san_1',
  status ENUM('open', 'resolved', 'skipped') NOT NULL DEFAULT 'open',
  candidates_json JSON NOT NULL,
  winner_city_id VARCHAR(64) NULL,
  winner_kind ENUM('pvp', 'pve') NULL,
  result_war_id VARCHAR(64) NULL,
  skip_reason VARCHAR(255) NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_faction_poll_date (faction_id, poll_date),
  KEY idx_poll_status_date (status, poll_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS faction_war_vote_ballots (
  poll_id BIGINT UNSIGNED NOT NULL,
  player_id VARCHAR(64) NOT NULL,
  city_id VARCHAR(64) NOT NULL,
  weight INT UNSIGNED NOT NULL DEFAULT 0,
  voted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (poll_id, player_id),
  KEY idx_ballot_city (poll_id, city_id),
  CONSTRAINT fk_war_vote_ballot_poll
    FOREIGN KEY (poll_id) REFERENCES faction_war_daily_polls (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
