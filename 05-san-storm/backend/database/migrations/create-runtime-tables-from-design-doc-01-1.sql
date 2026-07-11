-- Runtime / config tables aligned with docs/00/00-base/01-1-DATABASE_DESIGN.md
-- Dependency order: factions -> legions -> legion_members -> texts; ai_players -> accounts;
-- Safe to re-run: CREATE TABLE IF NOT EXISTS

-- §3.2.9 AI players
CREATE TABLE IF NOT EXISTS ai_players (
  player_id VARCHAR(4) PRIMARY KEY COMMENT 'AI player id (accounts.id)',
  ai_type ENUM('active', 'elite') NOT NULL COMMENT 'AI type',
  event_participation_types VARCHAR(100) DEFAULT 'daily',
  pvp_participation VARCHAR(20) DEFAULT 'defense_only',
  chat_frequency DECIMAL(3,2) DEFAULT 0.35,
  battle_strategy ENUM('balanced', 'aggressive') DEFAULT 'balanced',
  resource_strategy ENUM('basic', 'optimal') DEFAULT 'basic',
  total_logins INT DEFAULT 0,
  total_battles INT DEFAULT 0,
  total_chats INT DEFAULT 0,
  total_events_completed INT DEFAULT 0,
  performance_score DECIMAL(10,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  last_behavior_update DATETIME DEFAULT NULL,
  last_chat_time DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_ai_type (ai_type),
  INDEX idx_is_active (is_active),
  INDEX idx_performance_score (performance_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI player config';

-- §3.2.10 Factions
CREATE TABLE IF NOT EXISTS factions (
  id VARCHAR(50) PRIMARY KEY COMMENT 'faction id',
  season VARCHAR(20) NOT NULL,
  faction_name VARCHAR(100) NOT NULL,
  total_population BIGINT NOT NULL DEFAULT 0,
  total_trading BIGINT NOT NULL DEFAULT 0,
  total_farming BIGINT NOT NULL DEFAULT 0,
  total_military BIGINT NOT NULL DEFAULT 0,
  total_culture BIGINT NOT NULL DEFAULT 0,
  reserve_troops_quota_total INT NOT NULL DEFAULT 0,
  reserve_troops_quota_used INT NOT NULL DEFAULT 0,
  legendary_troop_quota_total INT NOT NULL DEFAULT 0,
  legendary_troop_quota_used INT NOT NULL DEFAULT 0,
  legendary_character_quota_total INT NOT NULL DEFAULT 0,
  legendary_character_quota_used INT NOT NULL DEFAULT 0,
  treasure_quota_total INT NOT NULL DEFAULT 0,
  treasure_quota_used INT NOT NULL DEFAULT 0,
  item_quota_total INT NOT NULL DEFAULT 0,
  item_quota_used INT NOT NULL DEFAULT 0,
  supply_tier_snapshot JSON DEFAULT NULL,
  troop_orange_probability DECIMAL(5,4) DEFAULT 0,
  character_orange_probability DECIMAL(5,4) DEFAULT 0,
  player_count INT DEFAULT 0,
  city_count INT DEFAULT 0,
  total_power BIGINT DEFAULT 0,
  last_settlement_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_season (season),
  INDEX idx_faction_name (faction_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Faction runtime';

-- §3.2.10c Faction reserve pool + usage aggregates
CREATE TABLE IF NOT EXISTS faction_reserve (
  faction_id VARCHAR(50) NOT NULL,
  category VARCHAR(32) NOT NULL COMMENT 'pool | war_start | march_food | stipend_bonus',
  silver BIGINT NOT NULL DEFAULT 0,
  food BIGINT NOT NULL DEFAULT 0,
  recovery_applied_date DATE NULL COMMENT 'pool row only',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (faction_id, category),
  INDEX idx_faction (faction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Faction silver/food pool and spend aggregates';

-- §3.2.12 Legions (requires factions)
CREATE TABLE IF NOT EXISTS legions (
  legion_id VARCHAR(50) PRIMARY KEY,
  legion_name VARCHAR(50) NOT NULL,
  faction_id VARCHAR(50) NOT NULL,
  commander_id VARCHAR(4) NOT NULL,
  commander_position_id VARCHAR(50) DEFAULT NULL,
  member_count INT DEFAULT 0,
  max_members INT DEFAULT 30,
  status ENUM('active', 'disbanded') DEFAULT 'active',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE,
  FOREIGN KEY (commander_id) REFERENCES players(player_id),
  INDEX idx_faction (faction_id),
  INDEX idx_commander (commander_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Legions';

-- §3.2.13 Legion members
CREATE TABLE IF NOT EXISTS legion_members (
  legion_id VARCHAR(50) NOT NULL,
  player_id VARCHAR(4) NOT NULL,
  role ENUM('commander', 'member') DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (legion_id, player_id),
  FOREIGN KEY (legion_id) REFERENCES legions(legion_id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  INDEX idx_player (player_id),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Legion members';

-- §3.3.11 Config items
CREATE TABLE IF NOT EXISTS config_items (
  item_id VARCHAR(50) PRIMARY KEY,
  item_name VARCHAR(100) NOT NULL,
  description TEXT,
  item_type ENUM('event_key') NOT NULL DEFAULT 'event_key',
  season VARCHAR(20) DEFAULT NULL,
  special_effect VARCHAR(128) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Item config';

-- §3.3.12 Config events
CREATE TABLE IF NOT EXISTS config_events (
  event_id VARCHAR(50) PRIMARY KEY,
  season VARCHAR(20) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  location VARCHAR(100) DEFAULT NULL,
  min_position_level INT DEFAULT NULL,
  trigger_probability DECIMAL(4,2) NOT NULL DEFAULT 0.10,
  trigger_context VARCHAR(50) DEFAULT NULL,
  chain_id VARCHAR(50) DEFAULT NULL,
  chain_level INT DEFAULT NULL,
  required_items VARCHAR(255) DEFAULT NULL,
  description_1 TEXT,
  description_2 TEXT,
  description_3 TEXT,
  option_a JSON DEFAULT NULL,
  option_b JSON DEFAULT NULL,
  INDEX idx_season (season),
  INDEX idx_location (location),
  INDEX idx_trigger_context (trigger_context),
  INDEX idx_chain_id (chain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Event config';

-- §3.2.19 Raids
CREATE TABLE IF NOT EXISTS raids (
  raid_id VARCHAR(50) PRIMARY KEY,
  raid_name VARCHAR(100) NOT NULL,
  raid_type ENUM('BANDIT', 'BARBARIAN', 'ALLIANCE') NOT NULL,
  ai_faction_id VARCHAR(50) NOT NULL,
  ai_faction_name VARCHAR(50) NOT NULL,
  ai_leader_name VARCHAR(50) DEFAULT NULL,
  ai_description TEXT,
  main_camp_hp INT NOT NULL,
  main_camp_max_hp INT NOT NULL,
  main_camp_status ENUM('active', 'destroyed') DEFAULT 'active',
  sub_camps JSON DEFAULT NULL,
  total_participants INT DEFAULT 0,
  total_battles INT DEFAULT 0,
  total_damage BIGINT DEFAULT 0,
  total_kills INT DEFAULT 0,
  player_rankings JSON DEFAULT NULL,
  faction_rankings JSON DEFAULT NULL,
  status ENUM('pending', 'active', 'completed', 'failed') DEFAULT 'pending',
  start_time DATETIME DEFAULT NULL,
  end_time DATETIME DEFAULT NULL,
  duration BIGINT DEFAULT 604800000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_raid_type (raid_type),
  INDEX idx_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Raids PVE';

-- §3.2.15 Texts (requires legions + players)
CREATE TABLE IF NOT EXISTS texts (
  text_id VARCHAR(50) PRIMARY KEY,
  type ENUM('player', 'legion', 'system', 'reward') NOT NULL,
  sender_id VARCHAR(4) NOT NULL,
  sender_name VARCHAR(50) NOT NULL,
  sender_position VARCHAR(50) DEFAULT NULL,
  receiver_id VARCHAR(4) DEFAULT NULL,
  target_legion_id VARCHAR(50) DEFAULT NULL,
  subject VARCHAR(100) NOT NULL,
  content VARCHAR(1000) NOT NULL,
  attachments JSON DEFAULT NULL,
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_at DATETIME DEFAULT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME DEFAULT NULL,
  expires_at DATETIME DEFAULT NULL,
  FOREIGN KEY (sender_id) REFERENCES players(player_id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES players(player_id) ON DELETE CASCADE,
  FOREIGN KEY (target_legion_id) REFERENCES legions(legion_id) ON DELETE CASCADE,
  INDEX idx_receiver (receiver_id, is_read, is_deleted, created_at),
  INDEX idx_sender (sender_id, created_at),
  INDEX idx_legion (target_legion_id, created_at),
  INDEX idx_expires (expires_at),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Mail / texts';
