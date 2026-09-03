-- 传书模板配置表 config_texts（与 01-1-DATABASE_DESIGN.md §3.3.14 一致）

CREATE TABLE IF NOT EXISTS config_texts (
  template_id VARCHAR(50) PRIMARY KEY COMMENT '模板ID',
  mail_type ENUM('system', 'reward') NOT NULL COMMENT '实例化到 texts.type',
  subject VARCHAR(100) NOT NULL COMMENT '标题',
  body TEXT NOT NULL COMMENT '正文',
  attachments_json JSON NULL COMMENT '奖励型附件',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  remark VARCHAR(255) NULL COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mail_type (mail_type),
  INDEX idx_enabled_sort (is_enabled, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='传书模板配置表';
