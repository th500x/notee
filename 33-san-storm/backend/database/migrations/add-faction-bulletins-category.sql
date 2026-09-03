-- 三公府公告三分区：谕旨 edict / 文书 document / 战事 war
ALTER TABLE faction_bulletins
  ADD COLUMN category VARCHAR(16) NOT NULL DEFAULT 'war'
    COMMENT 'edict|document|war' AFTER faction_id,
  ADD COLUMN author_player_id VARCHAR(64) NULL DEFAULT NULL COMMENT '文书作者 player_id' AFTER body,
  ADD COLUMN author_name VARCHAR(128) NULL DEFAULT NULL COMMENT '文书作者展示名' AFTER author_player_id;

ALTER TABLE faction_bulletins
  ADD KEY idx_faction_category (faction_id, category, id);
