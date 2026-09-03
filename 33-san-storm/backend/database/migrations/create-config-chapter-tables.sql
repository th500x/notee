-- 玩法二 P2：章节 / 节点 / 关卡 / 剧情配置表（CSV → JSON → import）

CREATE TABLE IF NOT EXISTS config_chapters (
  chapter_id VARCHAR(64) NOT NULL COMMENT '章节 ID（san_*_chapter_*）',
  season VARCHAR(16) NOT NULL DEFAULT 'san_1',
  chapter_name VARCHAR(64) NOT NULL,
  era VARCHAR(64) NULL COMMENT '如 184年4月上旬',
  description VARCHAR(512) NULL,
  completion_rewards JSON NULL COMMENT '章末奖励 {silver,food}',
  sort_order INT NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (chapter_id),
  INDEX idx_config_chapters_season (season, enabled, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='章节元数据';

CREATE TABLE IF NOT EXISTS config_chapter_nodes (
  node_id VARCHAR(32) NOT NULL COMMENT '节点短 ID（yc_01）',
  chapter_id VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  node_type VARCHAR(16) NOT NULL COMMENT 'battle|story',
  ref_id VARCHAR(64) NOT NULL COMMENT 'stage_id 或 story_id',
  next_node_id VARCHAR(32) NULL,
  next_node_ids VARCHAR(255) NULL COMMENT '分号分隔多后继',
  lineup_slots_override VARCHAR(32) NULL,
  entry_token_cost INT NOT NULL DEFAULT 0 COMMENT '未通关开战兵符；剧情默认 0',
  notes VARCHAR(255) NULL,
  PRIMARY KEY (node_id),
  INDEX idx_chapter_nodes_chapter (chapter_id, sort_order),
  CONSTRAINT fk_chapter_nodes_chapter FOREIGN KEY (chapter_id) REFERENCES config_chapters(chapter_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='章节节点链';

CREATE TABLE IF NOT EXISTS config_chapter_stages (
  stage_id VARCHAR(64) NOT NULL,
  stage_name VARCHAR(64) NOT NULL,
  chapter_id VARCHAR(64) NOT NULL,
  map_w INT NOT NULL,
  map_h INT NOT NULL,
  lineup_slots VARCHAR(32) NOT NULL DEFAULT 'main',
  deploy_pattern VARCHAR(64) NOT NULL DEFAULT 'player_south_enemy_north',
  terrain_brief VARCHAR(512) NULL,
  terrain_ratios VARCHAR(255) NULL,
  enemy_roster TEXT NULL,
  ally_roster TEXT NULL,
  max_rounds INT NOT NULL DEFAULT 30,
  min_rounds INT NULL,
  win_condition JSON NULL,
  lose_condition JSON NULL,
  reward_silver INT NOT NULL DEFAULT 0,
  reward_food INT NOT NULL DEFAULT 0,
  star_1 JSON NULL,
  star_2 JSON NULL,
  star_3 JSON NULL,
  star_rewards JSON NULL,
  map_ref VARCHAR(128) NULL,
  map_seed VARCHAR(64) NULL,
  notes VARCHAR(255) NULL,
  PRIMARY KEY (stage_id),
  INDEX idx_chapter_stages_chapter (chapter_id),
  CONSTRAINT fk_chapter_stages_chapter FOREIGN KEY (chapter_id) REFERENCES config_chapters(chapter_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='章节战斗关卡';

CREATE TABLE IF NOT EXISTS config_chapter_stories (
  story_id VARCHAR(64) NOT NULL,
  chapter_id VARCHAR(64) NOT NULL,
  title VARCHAR(128) NULL,
  lines_json JSON NOT NULL COMMENT '[{speaker,text,portrait?}]',
  notes VARCHAR(255) NULL,
  PRIMARY KEY (story_id),
  INDEX idx_chapter_stories_chapter (chapter_id),
  CONSTRAINT fk_chapter_stories_chapter FOREIGN KEY (chapter_id) REFERENCES config_chapters(chapter_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='章节剧情对话';
