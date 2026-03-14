-- Add selected_avatar column to temp_character_creation table
-- For storing the avatar selection during character creation

ALTER TABLE temp_character_creation
ADD COLUMN selected_avatar VARCHAR(255) COMMENT 'Selected avatar path'
AFTER selected_faction_name;
