-- 真三日报 · 全服昨日摘要快照（32-6 §9）
-- digest_date = 摘要所属游戏日（通常为 cron 运行时的「昨日」）

CREATE TABLE IF NOT EXISTS daily_report_digests (
  digest_date DATE NOT NULL COMMENT '摘要所属游戏日',
  server_id VARCHAR(20) NOT NULL COMMENT '分服键，与 accounts.server_id 对齐',
  payload_json JSON NOT NULL COMMENT '编排好的 digest（sections/warHotspots 等）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (digest_date, server_id),
  KEY idx_daily_report_digests_server (server_id, digest_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='真三日报 · 00:00 生成的全服昨日摘要';
