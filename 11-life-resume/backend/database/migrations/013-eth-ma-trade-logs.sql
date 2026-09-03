-- ETH 1h 交叉信号史 + 按账号操作记录
-- 数据库: 11_life_resume
-- 012 已被 accounts 占用。已跑过 010/011 的库执行一次。

CREATE TABLE IF NOT EXISTS eth_ma_cross_signals (
  open_time BIGINT NOT NULL COMMENT '已收盘柱开盘 UTC ms，与推送 tag / last_signal_open_time 相同',
  close_time BIGINT NOT NULL COMMENT '已收盘柱收盘 UTC ms',
  symbol VARCHAR(16) NOT NULL,
  kline_interval VARCHAR(8) NOT NULL,
  cross_kind ENUM('golden','death') NOT NULL,
  close DECIMAL(20,8) NOT NULL,
  sma7 DECIMAL(20,8) NULL,
  sma25 DECIMAL(20,8) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (open_time),
  KEY idx_eth_ma_signals_close_time (close_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ETH 均线交叉信号史（全局，交叉时写入）';

CREATE TABLE IF NOT EXISTS eth_ma_trade_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id CHAR(4) NOT NULL COMMENT '4位账号ID，与 JWT sub 同值',
  signal_open_time BIGINT NOT NULL COMMENT '对应 eth_ma_cross_signals.open_time',
  entry_price DECIMAL(20,8) NOT NULL COMMENT '购买价格',
  quantity DECIMAL(20,8) NOT NULL COMMENT '数量',
  take_profit_price DECIMAL(20,8) NOT NULL COMMENT '止盈价',
  stop_loss_price DECIMAL(20,8) NULL COMMENT '止损价，可空',
  closed_on DATE NULL COMMENT '止盈/止损日期，可空',
  pnl DECIMAL(20,8) NULL COMMENT '最终收益，手填，可空',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uk_eth_ma_trade_account_signal (account_id, signal_open_time),
  KEY idx_eth_ma_trade_account_closed (account_id, closed_on),
  CONSTRAINT fk_eth_ma_trade_signal
    FOREIGN KEY (signal_open_time) REFERENCES eth_ma_cross_signals (open_time)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ETH 均线操作记录（仅点记一笔后写入；一信号一笔）';

INSERT INTO eth_ma_cross_signals
  (open_time, close_time, symbol, kline_interval, cross_kind, close, sma7, sma25)
SELECT
  last_signal_open_time,
  CASE
    WHEN last_signal_at IS NOT NULL THEN CAST(UNIX_TIMESTAMP(last_signal_at) * 1000 AS UNSIGNED)
    ELSE last_signal_open_time
  END,
  symbol,
  kline_interval,
  last_signal_cross,
  last_signal_close,
  last_signal_sma7,
  last_signal_sma25
FROM eth_ma_cross_state
WHERE id = 1
  AND last_signal_open_time > 0
  AND last_signal_cross IS NOT NULL
  AND last_signal_close IS NOT NULL
ON DUPLICATE KEY UPDATE open_time = VALUES(open_time);
