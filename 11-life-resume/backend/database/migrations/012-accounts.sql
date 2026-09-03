-- 11 自持账号表（从 05_san_storm.accounts 复制结构；数据用 scripts/copy-accounts-from-san-storm.js 一次性拷入）
-- 05/33 原表保留作历史，不再由 11 读写

CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(4) NOT NULL,
  password VARCHAR(255) NOT NULL,
  birthMonth TINYINT NOT NULL,
  serverId VARCHAR(20) DEFAULT NULL COMMENT '历史区服字段；11 注册可空',
  account_type ENUM('real', 'ai') NOT NULL DEFAULT 'real',
  current_season VARCHAR(50) DEFAULT NULL COMMENT '历史赛季字段；11 注册可空',
  participated_seasons LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  hasPremium TINYINT(1) NOT NULL DEFAULT 0,
  province VARCHAR(50) DEFAULT NULL,
  city VARCHAR(50) DEFAULT NULL,
  clientIP VARCHAR(45) NOT NULL,
  machineId VARCHAR(64) NOT NULL,
  status ENUM('active', 'inactive', 'banned') NOT NULL DEFAULT 'active',
  banReason TEXT DEFAULT NULL,
  banUntil DATETIME DEFAULT NULL,
  registeredAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastLoginAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastActiveAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  loginCount INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_server_id (serverId),
  KEY idx_status (status),
  KEY idx_birth_month (birthMonth),
  KEY idx_last_active (lastActiveAt),
  KEY idx_current_season (current_season),
  KEY idx_account_type (account_type),
  KEY idx_accounts_machine_id (machineId),
  KEY idx_accounts_client_ip (clientIP)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Notee 账号（11 掌管；05 原表为历史）';
