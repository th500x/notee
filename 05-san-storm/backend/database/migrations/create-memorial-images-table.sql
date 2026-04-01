-- 纪念图表（milestone / daily / battle）
-- 规则：
-- 1) milestone 同一天可多张
-- 2) daily 每天唯一
-- 3) battle 每天唯一

CREATE TABLE IF NOT EXISTS memorial_images (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '纪念图ID',
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  season_id VARCHAR(50) NOT NULL COMMENT '赛季ID',
  server_id VARCHAR(50) NOT NULL COMMENT '服务器ID',

  image_type ENUM('milestone', 'daily', 'battle') NOT NULL COMMENT '图片类型',
  event_date DATE NOT NULL COMMENT '事件日期',
  battle_id VARCHAR(80) NULL COMMENT '关联战斗ID（仅battle）',

  image_url VARCHAR(500) NOT NULL COMMENT '图片URL',
  oss_key VARCHAR(500) NOT NULL COMMENT '存储key（本地/OSS）',
  file_size INT NULL COMMENT '文件大小（字节）',

  event_data JSON NOT NULL COMMENT '事件扩展数据',
  expires_at DATETIME NULL COMMENT '过期时间（milestone为NULL）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  -- 仅为 daily/battle 生成唯一键；milestone 为 NULL 可重复
  daily_event_date DATE GENERATED ALWAYS AS (CASE WHEN image_type = 'daily' THEN event_date ELSE NULL END) STORED,
  battle_event_date DATE GENERATED ALWAYS AS (CASE WHEN image_type = 'battle' THEN event_date ELSE NULL END) STORED,

  FOREIGN KEY (player_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_player (player_id),
  INDEX idx_player_season (player_id, season_id),
  INDEX idx_image_type (image_type),
  INDEX idx_event_date (event_date),
  INDEX idx_expires_at (expires_at),
  INDEX idx_battle_id (battle_id),
  UNIQUE KEY uk_daily_once_per_day (player_id, daily_event_date),
  UNIQUE KEY uk_battle_once_per_day (player_id, battle_event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='纪念图表';

