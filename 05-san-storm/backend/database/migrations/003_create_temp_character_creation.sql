-- Create character creation progress table (temporary table)
-- Used to store temporary data during character creation process
-- Automatically deleted after character creation is complete

CREATE TABLE IF NOT EXISTS temp_character_creation (
  player_id VARCHAR(4) PRIMARY KEY COMMENT 'Player ID (Account ID)',
  
  -- Creation progress
  current_step INT DEFAULT 1 COMMENT 'Current step (1=faction, 2=avatar, 3=name, 4=attributes, 5=troops)',
  
  -- Step 1: Faction selection
  selected_faction_id VARCHAR(50) COMMENT 'Selected faction ID',
  selected_faction_name VARCHAR(50) COMMENT 'Selected faction name',
  
  -- Step 2: Character name
  character_name VARCHAR(50) COMMENT 'Character name',
  
  -- Step 3: Attribute randomization
  remaining_silver INT DEFAULT 50 COMMENT 'Remaining silver (initial 50)',
  random_cost INT DEFAULT 10 COMMENT 'Cost per randomization (fixed 10)',
  current_batch INT DEFAULT 1 COMMENT 'Current viewing batch number',
  random_batches JSON COMMENT 'All random batch history',
  selected_option_batch INT COMMENT 'Batch number of selected option',
  selected_option_index INT COMMENT 'Index of selected option in batch (0-2)',
  
  -- Step 4: Initial troops
  selected_troops JSON COMMENT 'Selected initial troops (troop_id array, max 2)',
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation time',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Update time',
  expires_at DATETIME COMMENT 'Expiration time (7 days after creation)',
  
  FOREIGN KEY (player_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Character creation progress table (temporary data)';
