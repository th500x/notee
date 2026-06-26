-- 11-life-resume: 条目媒体支持 document bundle（单文件 ≤10MB）

USE `11_life_resume`;

ALTER TABLE life_entries
  MODIFY COLUMN media_bundle_type ENUM('none','photos','video','document') NOT NULL DEFAULT 'none';

ALTER TABLE life_entry_media
  MODIFY COLUMN media_type ENUM('photo','video','document') NOT NULL;
