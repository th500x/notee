-- 势力 Tab「公告」：按势力写入的战事/系统摘要行（M2，带时间戳正文存于 body）
-- 表名：两词 `faction` + `bulletins`（旧名 `faction_bulletin_entries` 见 rename 迁移）
-- 数据分层：与 `wars` / `wars_pvp` 同属 **势力·世界级（赛季内、非单玩家私有）** 运行时表；`faction_id` 对齐 `players.faction_id`，不设 FK 以免迁移顺序耦合。

CREATE TABLE IF NOT EXISTS faction_bulletins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  faction_id VARCHAR(64) NOT NULL COMMENT '势力 id，对齐 players.faction_id / wars_pvp.attacker_faction_id',
  body VARCHAR(512) NOT NULL COMMENT '整行展示文本，建议含 [YYYY-MM-DD HH:mm:ss] 前缀',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_faction_id (faction_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='势力公告流水（大地图势力 Tab）';
