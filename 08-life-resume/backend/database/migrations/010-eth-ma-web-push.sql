-- ETH 15m 均线交叉：Web Push 订阅 + 信号工人状态
-- 数据库: 11_life_resume

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id CHAR(4) NOT NULL COMMENT '4位账号ID，与05 accounts.id同值',
  endpoint VARCHAR(1024) NOT NULL COMMENT '浏览器 Push endpoint',
  endpoint_hash CHAR(64) NOT NULL COMMENT 'SHA-256(endpoint)，唯一键',
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_agent VARCHAR(512) NULL,
  topic VARCHAR(32) NOT NULL DEFAULT 'eth_ma_15m' COMMENT '订阅主题',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uk_push_endpoint_hash (endpoint_hash),
  KEY idx_push_account_topic (account_id, topic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Web Push 订阅（07 ETH 均线等）';

CREATE TABLE IF NOT EXISTS eth_ma_cross_state (
  id TINYINT UNSIGNED NOT NULL COMMENT '单行状态，固定为 1',
  symbol VARCHAR(16) NOT NULL COMMENT 'ETHUSDT',
  kline_interval VARCHAR(8) NOT NULL COMMENT '15m',
  last_closed_open_time BIGINT NOT NULL DEFAULT 0 COMMENT '最近已收盘柱开盘 UTC ms',
  last_closed_close_time BIGINT NOT NULL DEFAULT 0 COMMENT '最近已收盘柱收盘 UTC ms',
  last_close DECIMAL(20,8) NULL,
  last_sma7 DECIMAL(20,8) NULL,
  last_sma25 DECIMAL(20,8) NULL,
  last_bar_cross ENUM('golden','death') NULL COMMENT '最近一根柱上的交叉，无则为 NULL',
  last_signal_cross ENUM('golden','death') NULL COMMENT '最近一次金叉/死叉',
  last_signal_open_time BIGINT NOT NULL DEFAULT 0,
  last_signal_close DECIMAL(20,8) NULL,
  last_signal_sma7 DECIMAL(20,8) NULL,
  last_signal_sma25 DECIMAL(20,8) NULL,
  last_signal_at DATETIME(3) NULL,
  last_notified_open_time BIGINT NOT NULL DEFAULT 0 COMMENT '已推送的柱开盘 ms，防重复',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ETH 15m 均线交叉工人状态';

INSERT INTO eth_ma_cross_state (id, symbol, kline_interval)
VALUES (1, 'ETHUSDT', '15m')
ON DUPLICATE KEY UPDATE id = id;
