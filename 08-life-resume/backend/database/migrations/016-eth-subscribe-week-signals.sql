-- ETH 订阅方案 prefs + 周指标信号 + 操作记录支持均线/周双来源
-- 数据库: 00_notee

CREATE TABLE IF NOT EXISTS eth_subscribe_prefs (
  account_id CHAR(4) NOT NULL COMMENT '4位账号ID',
  notify_plan ENUM('plan_a', 'plan_b') NOT NULL DEFAULT 'plan_b'
    COMMENT 'plan_a=均线+指标(非中性) plan_b=均线+必荐',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ETH 订阅方案（账号级，默认 Plan B）';

CREATE TABLE IF NOT EXISTS eth_week_signals (
  week_id VARCHAR(16) NOT NULL COMMENT '如 2026-W40',
  week_open_time BIGINT NOT NULL COMMENT '该周周一 00:00 UTC ms',
  bias ENUM('long', 'short', 'neutral') NOT NULL COMMENT '个人评级侧',
  personal_rating DECIMAL(8, 2) NULL,
  t0_must ENUM('buy', 'sell') NULL,
  t1_recommend ENUM('buy', 'sell') NULL,
  eth_week_avg DECIMAL(20, 8) NULL COMMENT 'ETH 周均价，待记预填用',
  broadcast_done TINYINT(1) NOT NULL DEFAULT 0 COMMENT '已向匹配方案订阅者广播',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (week_id),
  KEY idx_eth_week_signals_open (week_open_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ETH 周指标信号（非中性或必/荐时写入）';

-- 操作记录：放开仅均线 FK，支持 week 来源
ALTER TABLE eth_ma_trade_logs
  DROP FOREIGN KEY fk_eth_ma_trade_signal;

ALTER TABLE eth_ma_trade_logs
  DROP INDEX uk_eth_ma_trade_account_signal;

ALTER TABLE eth_ma_trade_logs
  ADD COLUMN signal_source ENUM('ma', 'week') NOT NULL DEFAULT 'ma'
    COMMENT 'ma=金叉死叉 week=周指标' AFTER account_id,
  ADD COLUMN week_id VARCHAR(16) NULL
    COMMENT 'signal_source=week 时必填' AFTER signal_open_time,
  ADD UNIQUE KEY uk_eth_trade_ma (account_id, signal_source, signal_open_time),
  ADD UNIQUE KEY uk_eth_trade_week (account_id, signal_source, week_id),
  ADD KEY idx_eth_trade_week_id (week_id);
