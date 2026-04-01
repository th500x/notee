-- 将领排名快照（临时表）：同服同 bucket 可排序缓存，详见 docs/00-base/01-1-DATABASE_DESIGN.md §4.5
-- 与 UI 口径：docs/90-assets/92-1-GAME_UI_DESIGN.md §9.1.2
-- 历史表名：player_character_rank_snapshot / temp_character_rank_snapshots → 见 migrations/rename-*.sql

CREATE TABLE IF NOT EXISTS temp_character_ranking_snapshots (
  player_id VARCHAR(8) NOT NULL COMMENT '玩家角色 ID',
  server_id VARCHAR(64) NOT NULL COMMENT '服务器（accounts.serverId）',
  bucket VARCHAR(48) NOT NULL COMMENT '槽位键，如 main:player、garrison:2:char1',
  ranking_score DECIMAL(18, 8) NOT NULL COMMENT '加权综合分（用于排序）',
  luck DECIMAL(14, 6) NOT NULL,
  combat DECIMAL(14, 6) NOT NULL,
  courage DECIMAL(14, 6) NOT NULL,
  command DECIMAL(14, 6) NOT NULL,
  intelligence DECIMAL(14, 6) NOT NULL,
  politics DECIMAL(14, 6) NOT NULL,
  charm DECIMAL(14, 6) NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '上次刷新时间；超过14天未更新则定时任务删除',
  PRIMARY KEY (player_id, bucket),
  KEY idx_srv_bucket (server_id, bucket),
  KEY idx_srv_bucket_ranking_score (server_id, bucket, ranking_score),
  KEY idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='将领排名快照（临时数据，14天未刷新则清理）';
