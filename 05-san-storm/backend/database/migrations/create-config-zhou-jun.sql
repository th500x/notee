-- 州 / 郡 配置表 + 郡邻接表（与 docs/tools/city CSV 列名一致：主键为 zhou_id / jun_id，不用泛用 id）
-- 本目录 CSV 仅导入 config_zhou、config_jun；config_jun_node 数据由郡地图 / preset 工具链写入。
-- 执行后再运行: node backend/database/import-city-geo-data.js
-- 安全重复执行：CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS config_zhou (
  zhou_id VARCHAR(64) PRIMARY KEY COMMENT '与 CSV zhou_id、赛季前缀如 san_1_zhou_yu',
  season VARCHAR(20) NOT NULL COMMENT '从 zhou_id 前缀解析，如 san_1',
  zhou_name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  description TEXT NULL,
  INDEX idx_season (season),
  INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='州配置';

CREATE TABLE IF NOT EXISTS config_jun (
  jun_id VARCHAR(64) PRIMARY KEY COMMENT '与 CSV jun_id',
  season VARCHAR(20) NOT NULL,
  zhou_id VARCHAR(64) NOT NULL COMMENT 'FK → config_zhou.zhou_id',
  jun_name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  description TEXT NULL,
  INDEX idx_season (season),
  INDEX idx_zhou (zhou_id),
  INDEX idx_sort (sort_order),
  CONSTRAINT fk_config_jun_zhou FOREIGN KEY (zhou_id) REFERENCES config_zhou(zhou_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='郡配置';

CREATE TABLE IF NOT EXISTS config_jun_node (
  season VARCHAR(20) NOT NULL,
  jun_id_a VARCHAR(64) NOT NULL COMMENT '须字典序小于 jun_id_b',
  jun_id_b VARCHAR(64) NOT NULL,
  PRIMARY KEY (jun_id_a, jun_id_b),
  INDEX idx_season (season),
  CONSTRAINT fk_config_jun_node_a FOREIGN KEY (jun_id_a) REFERENCES config_jun(jun_id) ON DELETE CASCADE,
  CONSTRAINT fk_config_jun_node_b FOREIGN KEY (jun_id_b) REFERENCES config_jun(jun_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='郡邻接无向边（数据由地图工具链维护）';
