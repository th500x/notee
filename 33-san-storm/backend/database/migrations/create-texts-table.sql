-- 传书表 texts（若不存在则创建；与 01-1-DATABASE_DESIGN.md §3.2.15 一致）
-- 依赖：players、legions；系统发件人 sys1 见 seed-system-player-sys1.sql

CREATE TABLE IF NOT EXISTS texts (
  text_id VARCHAR(50) PRIMARY KEY COMMENT '传书ID',
  type ENUM('player', 'legion', 'system', 'reward') NOT NULL COMMENT '传书类型',
  sender_id VARCHAR(4) NOT NULL COMMENT '发送者ID',
  sender_name VARCHAR(50) NOT NULL COMMENT '发送者名称（冗余）',
  sender_position VARCHAR(50) COMMENT '发送者官职（军团传书）',
  receiver_id VARCHAR(4) COMMENT '接收者ID（单发）',
  target_legion_id VARCHAR(50) COMMENT '目标军团ID（群发）',
  subject VARCHAR(100) NOT NULL COMMENT '标题',
  content VARCHAR(1000) NOT NULL COMMENT '内容',
  attachments JSON COMMENT '附件（奖励）',
  is_claimed BOOLEAN DEFAULT FALSE COMMENT '附件是否已领取',
  claimed_at DATETIME COMMENT '领取时间',
  is_read BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否删除（软删除）',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  read_at DATETIME COMMENT '阅读时间',
  expires_at DATETIME COMMENT '过期时间',
  FOREIGN KEY (sender_id) REFERENCES players(player_id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES players(player_id) ON DELETE CASCADE,
  FOREIGN KEY (target_legion_id) REFERENCES legions(legion_id) ON DELETE CASCADE,
  INDEX idx_receiver (receiver_id, is_read, is_deleted, created_at),
  INDEX idx_sender (sender_id, created_at),
  INDEX idx_legion (target_legion_id, created_at),
  INDEX idx_expires (expires_at),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='传书表';
