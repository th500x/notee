-- 聊天表 chats（实时公屏，保留策略见 01-1 §3.2.14）
-- 若表已存在可整文件跳过

CREATE TABLE IF NOT EXISTS chats (
  chat_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '聊天ID（自增）',

  channel_type ENUM('world', 'faction', 'legion') NOT NULL COMMENT '频道类型',
  channel_id VARCHAR(50) COMMENT '频道ID（势力ID或军团ID），天下为NULL',

  sender_id VARCHAR(4) NOT NULL COMMENT '发送者ID',
  sender_name VARCHAR(50) NOT NULL COMMENT '发送者名称',
  sender_faction_id VARCHAR(50) COMMENT '发送者势力ID',

  content VARCHAR(100) NOT NULL COMMENT '内容（最多100字符）',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  expires_at DATETIME COMMENT '过期时间（创建时间+3天）',

  FOREIGN KEY (sender_id) REFERENCES players(player_id) ON DELETE CASCADE,

  INDEX idx_channel (channel_type, channel_id, created_at),
  INDEX idx_sender (sender_id, created_at),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天表';
