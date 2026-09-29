-- 用户名可重名；档案级 IP 地区（国家·省/府）展示后缀

USE `11_life_resume`;

ALTER TABLE life_profiles
  DROP INDEX IF EXISTS uk_username_normalized;

ALTER TABLE life_profiles
  MODIFY COLUMN username_normalized VARCHAR(16) NOT NULL COMMENT '比较用：英文小写，中文原样；可重名',
  ADD COLUMN region_public_label VARCHAR(128) NULL COMMENT 'IP 解析展示：国家·省/府' AFTER username_normalized,
  ADD COLUMN region_updated_at DATETIME(3) NULL COMMENT '上次 IP 地区解析时间' AFTER region_public_label;
