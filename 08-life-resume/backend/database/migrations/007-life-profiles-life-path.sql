-- lifePath：AI 人生轨迹草稿与发布文本

USE `11_life_resume`;

ALTER TABLE life_profiles
  ADD COLUMN life_path_status ENUM('none', 'draft', 'published') NOT NULL DEFAULT 'none'
    COMMENT '人生轨迹 lifecycle' AFTER first_entry_at,
  ADD COLUMN life_path_draft_json JSON NULL
    COMMENT 'AI 草稿 JSON' AFTER life_path_status,
  ADD COLUMN life_path_published_text TEXT NULL
    COMMENT '已发布对外全文' AFTER life_path_draft_json,
  ADD COLUMN life_path_generated_at DATETIME(3) NULL
    COMMENT '最近成功生成草稿' AFTER life_path_published_text,
  ADD COLUMN life_path_published_at DATETIME(3) NULL
    COMMENT '最近发布' AFTER life_path_generated_at;
