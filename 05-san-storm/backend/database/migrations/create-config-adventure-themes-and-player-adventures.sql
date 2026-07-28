-- 探险系统：主题配置 + 玩家派遣进度（与手动事件系统独立）
-- theme_id 直接使用 04-1 规范 san_{赛季}_adv_{slug}；文末 UPDATE 兼容偶发旧式 adv_* 行（幂等）
-- duration_hours：DECIMAL(8,4) 支持亚小时（如测试 0.0167≈1 分钟）；已建表库文末 MODIFY 幂等对齐

CREATE TABLE IF NOT EXISTS config_adventure_themes (
  theme_id VARCHAR(64) NOT NULL COMMENT '主题 ID（san_*_adv_*）',
  season VARCHAR(16) NOT NULL DEFAULT 'san_1' COMMENT '赛季',
  theme_name VARCHAR(64) NOT NULL COMMENT '展示名',
  tone VARCHAR(32) NOT NULL DEFAULT 'patrol' COMMENT '叙事语气键',
  description VARCHAR(255) NULL COMMENT '短说明',
  duration_hours DECIMAL(8,4) NOT NULL DEFAULT 4 COMMENT '派遣时长（小时；可小数，如 0.0167≈1分钟）',
  encounter_rate DECIMAL(5,4) NOT NULL DEFAULT 0 COMMENT '遇敌概率 0～1',
  enemy_tier VARCHAR(16) NOT NULL DEFAULT 'normal' COMMENT '敌方强度档 normal/rare/epic/legendary',
  reward_silver_min INT NOT NULL DEFAULT 0,
  reward_silver_max INT NOT NULL DEFAULT 0,
  reward_food_min INT NOT NULL DEFAULT 0,
  reward_food_max INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (theme_id),
  INDEX idx_adv_theme_season (season, is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='探险主题配置';

CREATE TABLE IF NOT EXISTS player_adventures (
  adventure_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id VARCHAR(4) NOT NULL,
  extra_slot INT NOT NULL COMMENT 'Extra 槽 1–4',
  theme_id VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL COMMENT 'dispatched|ready|claimed',
  dispatched_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  resolve_json JSON NULL COMMENT '事实卡/战报/奖励/剧情',
  story_text TEXT NULL,
  claimed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (adventure_id),
  INDEX idx_player_adv_status (player_id, status),
  INDEX idx_player_adv_extra (player_id, extra_slot, status),
  CONSTRAINT fk_player_adv_player FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家探险派遣';

-- 若曾写入旧式 adv_*（无 san_ 前缀），一并改到规范 ID（已是新 ID 时影响 0 行）
UPDATE player_adventures SET theme_id = 'san_1_adv_patrol' WHERE theme_id = 'adv_patrol';
UPDATE player_adventures SET theme_id = 'san_1_adv_escort' WHERE theme_id = 'adv_escort';
UPDATE player_adventures SET theme_id = 'san_1_adv_forage' WHERE theme_id = 'adv_forage';
UPDATE player_adventures SET theme_id = 'san_1_adv_raid' WHERE theme_id = 'adv_raid';

UPDATE config_adventure_themes SET theme_id = 'san_1_adv_patrol' WHERE theme_id = 'adv_patrol';
UPDATE config_adventure_themes SET theme_id = 'san_1_adv_escort' WHERE theme_id = 'adv_escort';
UPDATE config_adventure_themes SET theme_id = 'san_1_adv_forage' WHERE theme_id = 'adv_forage';
UPDATE config_adventure_themes SET theme_id = 'san_1_adv_raid' WHERE theme_id = 'adv_raid';

-- 已用旧精度 DECIMAL(6,2) 建表的库：对齐为 DECIMAL(8,4)（幂等）
ALTER TABLE config_adventure_themes
  MODIFY COLUMN duration_hours DECIMAL(8,4) NOT NULL DEFAULT 4
  COMMENT '派遣时长（小时；可小数，如 0.0167≈1分钟）';
