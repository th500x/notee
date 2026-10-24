-- 待记信号按账号隐藏。不写操作记录，不删全局信号。
-- 数据库: 00_notee

CREATE TABLE IF NOT EXISTS eth_ma_signal_dismissals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id CHAR(4) NOT NULL COMMENT '4位账号ID，与 JWT sub 同值',
  signal_source ENUM('ma', 'week') NOT NULL COMMENT 'ma=金叉死叉 week=周指标',
  signal_open_time BIGINT NULL COMMENT 'signal_source=ma 时为交叉 open_time',
  week_id VARCHAR(16) NULL COMMENT 'signal_source=week 时为周 ID',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uk_eth_dismiss_ma (account_id, signal_source, signal_open_time),
  UNIQUE KEY uk_eth_dismiss_week (account_id, signal_source, week_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ETH 待记信号隐藏（仅当前账号；点删除后写入）';
