-- 人生片段系列：自定义系列表 + 条目归属 + 主页默认系列

CREATE TABLE IF NOT EXISTS life_entry_series (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id CHAR(4) NOT NULL COMMENT '所属用户',
  name VARCHAR(16) NOT NULL COMMENT '系列展示名，应用层校验≤5汉字',
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '设置页与切换器排序',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  KEY idx_entry_series_account (account_id),
  UNIQUE KEY uk_entry_series_account_name (account_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户自定义人生片段系列（不含内置编年历）';

ALTER TABLE life_entries
  ADD COLUMN entry_series_id BIGINT UNSIGNED NULL
    COMMENT 'NULL=编年历；非空指向 life_entry_series.id'
    AFTER account_id,
  ADD KEY idx_entries_account_series (account_id, entry_series_id);

ALTER TABLE life_profiles
  ADD COLUMN default_entry_series_id BIGINT UNSIGNED NULL
    COMMENT '主页默认展示的系列；NULL=编年历'
    AFTER default_grantee_account_id;
