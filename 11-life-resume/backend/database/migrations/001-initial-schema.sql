-- 11-life-resume 初始 schema
-- 数据库: 11_life_resume
-- 字符集: utf8mb4
-- 依赖: MySQL 5.7+ / MariaDB 10.2.1+（CHECK 在 5.7 仅解析不 enforce；JSON 列无 DEFAULT，由应用写入 []）

CREATE DATABASE IF NOT EXISTS `11_life_resume`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `11_life_resume`;

-- ---------------------------------------------------------------------------
-- life_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS life_profiles (
  account_id CHAR(4) NOT NULL COMMENT '4位账号ID，与05 accounts.id同值，无跨库FK',
  username VARCHAR(16) NOT NULL COMMENT '展示昵称',
  username_normalized VARCHAR(16) NOT NULL COMMENT '唯一性：英文小写，中文原样',
  username_changed_at DATETIME(3) NULL COMMENT '上次改名时间',
  page_default_visibility ENUM('public','private','specific') NOT NULL DEFAULT 'public' COMMENT '新建条目默认权限',
  default_grantee_account_id CHAR(4) NULL COMMENT '默认specific时的grantee',
  profile_status ENUM('active','deactivated') NOT NULL DEFAULT 'active' COMMENT 'active=正常 deactivated=注销冷静期',
  deactivated_at DATETIME(3) NULL COMMENT '发起注销时间',
  purge_scheduled_at DATETIME(3) NULL COMMENT '计划物理清除=deactivated_at+30天',
  first_entry_at DATETIME(3) NULL COMMENT '首次发布条目',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (account_id),
  UNIQUE KEY uk_username_normalized (username_normalized),
  KEY idx_profile_status (profile_status),
  KEY idx_purge_scan (profile_status, purge_scheduled_at),

  CONSTRAINT chk_profile_default_grantee_format CHECK (
    default_grantee_account_id IS NULL
    OR default_grantee_account_id REGEXP '^[0-9][A-Z0-9]{3}$'
  ),
  CONSTRAINT chk_profile_deactivated_consistency CHECK (
    (profile_status = 'active' AND deactivated_at IS NULL AND purge_scheduled_at IS NULL)
    OR (profile_status = 'deactivated' AND deactivated_at IS NOT NULL AND purge_scheduled_at IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='11人生片段用户扩展';

-- ---------------------------------------------------------------------------
-- life_entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS life_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id CHAR(4) NOT NULL COMMENT '所属用户',
  year SMALLINT UNSIGNED NULL COMMENT '公元年，与 life_stage 互斥',
  life_stage ENUM('unknown') NULL COMMENT '时间未知；与 year 互斥',
  month TINYINT UNSIGNED NULL COMMENT '1-12',
  day TINYINT UNSIGNED NULL COMMENT '1-31',
  timeline_sort_key BIGINT NOT NULL COMMENT '时间轴排序键，升序',
  title VARCHAR(128) NULL COMMENT '可选标题',
  body TEXT NOT NULL COMMENT '正文',
  body_grapheme_count SMALLINT UNSIGNED NOT NULL COMMENT '字素簇计数1-500',
  visibility ENUM('public','private','specific') NOT NULL COMMENT '单条权限',
  grantee_account_id CHAR(4) NULL COMMENT 'specific时唯一授权viewer',
  tags JSON NOT NULL COMMENT '标签数组：学业/工作/旅行/家庭/人生；插入时须 JSON.stringify([])',
  latitude DECIMAL(10,7) NULL COMMENT '精确纬度，仅owner可读',
  longitude DECIMAL(10,7) NULL COMMENT '精确经度',
  location_public_label VARCHAR(128) NULL COMMENT '城/区县展示文案',
  location_capture_method ENUM('none','geolocation','map_pick') NOT NULL DEFAULT 'none',
  media_bundle_type ENUM('none','photos','video') NOT NULL DEFAULT 'none',
  google_drive_share_url VARCHAR(1024) NULL COMMENT 'Google云盘https分享链接，每条目最多1条',
  google_drive_resource_id VARCHAR(128) NULL COMMENT '解析出的Google resource id',
  google_drive_resource_kind ENUM('file','folder','document','spreadsheet','presentation','form') NULL,
  google_drive_display_label VARCHAR(64) NULL COMMENT '云盘链接展示文案',
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  published_at DATETIME(3) NULL,
  compliance_ack_at DATETIME(3) NULL COMMENT '内容规范确认',
  chain_tx_hash VARCHAR(128) NULL COMMENT '链上纪念二期',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  KEY idx_entries_owner_timeline (account_id, status, timeline_sort_key),
  KEY idx_entries_owner_public_timeline (account_id, status, visibility, timeline_sort_key),
  KEY idx_entries_grantee_specific (grantee_account_id, visibility, status, account_id),
  KEY idx_entries_account_year (account_id, year),

  CONSTRAINT fk_entries_profile FOREIGN KEY (account_id)
    REFERENCES life_profiles (account_id) ON DELETE CASCADE,

  CONSTRAINT chk_entry_year_or_stage CHECK (
    (year IS NOT NULL AND life_stage IS NULL)
    OR (year IS NULL AND life_stage IS NOT NULL)
  ),
  CONSTRAINT chk_entry_month_requires_year CHECK (month IS NULL OR year IS NOT NULL),
  CONSTRAINT chk_entry_day_requires_month CHECK (day IS NULL OR month IS NOT NULL),
  CONSTRAINT chk_entry_month_range CHECK (month IS NULL OR month BETWEEN 1 AND 12),
  CONSTRAINT chk_entry_day_range CHECK (day IS NULL OR day BETWEEN 1 AND 31),
  CONSTRAINT chk_entry_specific_grantee CHECK (
    visibility <> 'specific' OR grantee_account_id IS NOT NULL
  ),
  CONSTRAINT chk_entry_non_specific_grantee_null CHECK (
    visibility = 'specific' OR grantee_account_id IS NULL
  ),
  CONSTRAINT chk_entry_grantee_format CHECK (
    grantee_account_id IS NULL OR grantee_account_id REGEXP '^[0-9][A-Z0-9]{3}$'
  ),
  CONSTRAINT chk_entry_body_grapheme_count CHECK (body_grapheme_count BETWEEN 1 AND 500),
  CONSTRAINT chk_entry_lat_lon_pair CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  ),
  CONSTRAINT chk_entry_google_drive_pair CHECK (
    (google_drive_share_url IS NULL AND google_drive_resource_id IS NULL AND google_drive_resource_kind IS NULL)
    OR (google_drive_share_url IS NOT NULL AND google_drive_resource_id IS NOT NULL AND google_drive_resource_kind IS NOT NULL)
  ),
  CONSTRAINT chk_entry_google_drive_url_https CHECK (
    google_drive_share_url IS NULL OR google_drive_share_url LIKE 'https://%'
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人生片段条目';

-- ---------------------------------------------------------------------------
-- life_entry_media
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS life_entry_media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entry_id BIGINT UNSIGNED NOT NULL,
  account_id CHAR(4) NOT NULL COMMENT '冗余，便于OSS清理',
  media_type ENUM('photo','video') NOT NULL,
  oss_key VARCHAR(512) NOT NULL,
  thumb_oss_key VARCHAR(512) NULL,
  original_filename VARCHAR(255) NULL,
  mime_type VARCHAR(128) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  width SMALLINT UNSIGNED NULL,
  height SMALLINT UNSIGNED NULL,
  duration_ms INT UNSIGNED NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  KEY idx_media_entry_sort (entry_id, sort_order),
  KEY idx_media_account (account_id),

  CONSTRAINT fk_media_entry FOREIGN KEY (entry_id)
    REFERENCES life_entries (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='片段条目媒体';
