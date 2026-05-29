-- 匪寨世界实例表（01-database-split/30-tables-world §3.2.11a）
CREATE TABLE IF NOT EXISTS bandits (
  bandit_id VARCHAR(32) NOT NULL COMMENT '匪寨实例 ID',
  jun_id VARCHAR(64) NOT NULL COMMENT '郡 ID，FK → config_jun.jun_id，与 cities.jun_id 命名一致',
  slot_index TINYINT NOT NULL DEFAULT 0 COMMENT '每郡槽位 0 或 1',
  tile_key VARCHAR(64) NULL COMMENT '瓦片锚点，可空',
  max_layers INT NOT NULL DEFAULT 200 COMMENT '全服可耗胜利层上限',
  cleared_layers INT NOT NULL DEFAULT 0 COMMENT '全服已累计胜利层数',
  status ENUM('active', 'closed') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '实例创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行更新时间',
  closed_at DATETIME NULL COMMENT '关闭时间',
  last_refresh DATE NULL COMMENT '按日历日的刷新统计（可选）',
  PRIMARY KEY (bandit_id),
  KEY idx_jun (jun_id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='匪寨实例（全服耐久与位置）';
