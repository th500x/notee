CREATE DATABASE IF NOT EXISTS rental_tracking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE rental_tracking;

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  password VARCHAR(255) DEFAULT NULL,
  visible BOOLEAN DEFAULT TRUE,
  properties JSON DEFAULT NULL,
  property_groups JSON DEFAULT NULL,
  expenses JSON DEFAULT NULL,
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_visible (visible),
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SHOW TABLES;
DESC projects;
