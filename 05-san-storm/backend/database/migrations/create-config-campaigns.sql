-- 战役卡片配置表（与 docs/00/00-base/01-1-DATABASE_DESIGN.md §3.3.15 一致）
-- 地图 preset 仅存仓库 shared/data/campaign/{campaign_id}.preset.json，不入库
-- 安全重复执行：CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS config_campaigns (
  campaign_id VARCHAR(64) PRIMARY KEY COMMENT '与 campaign-template.csv、preset 文件名、player_progress 键一致',
  season VARCHAR(20) NOT NULL COMMENT '从 campaign_id 提取，如 san_1',
  campaign_name VARCHAR(100) NOT NULL,
  campaign_type VARCHAR(40) NOT NULL COMMENT 'CSV 英文，如 Attack Battle',
  era VARCHAR(32) NOT NULL COMMENT '游戏历法展示，如 184年4月上旬；解锁与排序由服务端解析',
  faction VARCHAR(512) NOT NULL COMMENT '可参与势力，英文分号分隔',
  max_rounds INT NOT NULL,
  min_rounds INT NULL COMMENT '特殊模式下限；无则 NULL',
  completion_reward_silver INT NOT NULL,
  completion_reward_food INT NOT NULL,
  completion_reward_badge VARCHAR(32) NULL COMMENT '通关奖励徽章：数字表示第 N 枚赛季徽章；空表示无',
  description_1 TEXT NOT NULL,
  description_2 TEXT NOT NULL,
  description_3 TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0 COMMENT '列表顺序；同解锁态可与 era 解析排序配合',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_season_enabled (season, enabled),
  INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='战役卡片配置表';
