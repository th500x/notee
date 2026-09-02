-- ETH 均线交叉：15m → 1h（清状态 + 订阅主题）
-- 数据库: 11_life_resume
-- 已跑过 010 的库执行一次。kline_interval 已是 1h 时不重复清状态。

ALTER TABLE web_push_subscriptions
  MODIFY topic VARCHAR(32) NOT NULL DEFAULT 'eth_ma_1h' COMMENT '订阅主题';

UPDATE web_push_subscriptions
SET topic = 'eth_ma_1h'
WHERE topic = 'eth_ma_15m';

UPDATE eth_ma_cross_state
SET
  kline_interval = '1h',
  last_closed_open_time = 0,
  last_closed_close_time = 0,
  last_close = NULL,
  last_sma7 = NULL,
  last_sma25 = NULL,
  last_bar_cross = NULL,
  last_signal_cross = NULL,
  last_signal_open_time = 0,
  last_signal_close = NULL,
  last_signal_sma7 = NULL,
  last_signal_sma25 = NULL,
  last_signal_at = NULL,
  last_notified_open_time = 0
WHERE id = 1
  AND kline_interval <> '1h';
