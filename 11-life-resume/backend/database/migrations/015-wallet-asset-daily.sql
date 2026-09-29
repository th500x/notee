-- 按账号保存钱包地址，并按日记下合计，供月均。
-- 日历日用 Asia/Bangkok（UTC+7）。已跑过 014 的库执行一次。

CREATE TABLE IF NOT EXISTS wallet_asset_watches (
  account_id CHAR(4) NOT NULL COMMENT '4位账号，与 JWT sub 同值',
  address CHAR(42) NOT NULL COMMENT '小写 0x 地址',
  tracking_starts_on DATE NOT NULL COMMENT '保存或更换地址后的下月1日；此日之前不计入月均',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每账号一个钱包地址';

CREATE TABLE IF NOT EXISTS wallet_asset_daily (
  account_id CHAR(4) NOT NULL,
  address CHAR(42) NOT NULL,
  snapshot_date DATE NOT NULL COMMENT 'Asia/Bangkok 日历日',
  total_usd DECIMAL(20,2) NOT NULL,
  wallet_usd DECIMAL(20,2) NOT NULL,
  position_usd DECIMAL(20,2) NOT NULL,
  fees_usd DECIMAL(20,2) NOT NULL,
  rewards_usd DECIMAL(20,2) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (account_id, snapshot_date),
  KEY idx_wallet_daily_address_day (address, snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='钱包资产每日合计；失败的日子不写行';
