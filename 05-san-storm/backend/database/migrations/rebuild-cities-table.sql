-- =============================================================================
-- 危险操作：DROP + 重建 cities（与 add-city-siege-tables.sql / 01 §3.2.11 一致）
-- =============================================================================
-- 适用：旧版 cities（governor_*、has_*、npc_max_rarity、缺 market 枚举等）与
--       当前设计无法靠 ALTER 低成本对齐时，在已备份、可接受丢失城市表内数据时执行。
--
-- 生产/预发：先 mysqldump；维护窗口执行；下列顺序跑完后做冒烟（攻城、驻守、披挂）。
--
-- 建议顺序（本地同理）：
--   1. create-config-zhou-jun.sql（若尚无 config_zhou / config_jun / config_jun_node）
--   2. 本文件 rebuild-cities-table.sql
--   3. factions：import 写入的 faction_id 有 FK；cities_seed 里每个 initialFactionId 须已在 factions 存在
--      （先跑势力同步管线，或按报错补行），否则会在首条违规城市失败。
--   4. node backend/database/import-city-geo-data.js
--   5. 测试新野 NPC 支数：node backend/database/scripts/seed-xinye-npc-garrison-400.js
--      （当前 cities_seed 未必含新野行；大地图测新野须执行此步，
--       或把新野写入 cities_template.csv 后重跑 city-csv-to-json 再 import）
--
-- 说明：player_garrison.city_id、players.on_duty_city_id 等无 FK 指向 cities 时，
--       MySQL 不会级联清空；重建后可能出现「引用已不存在 city_id」的孤儿字符串，
--       测试库可手动 UPDATE 清空或忽略；生产须按业务决定是否清洗。
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS cities;

CREATE TABLE cities (
  city_id VARCHAR(50) PRIMARY KEY COMMENT '城市ID（如：san_1_city_3_xinye）；与策划 CSV city_id 同名列',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID',
  city_name VARCHAR(100) NOT NULL COMMENT '城市名称（系统默认展示名）',
  city_type ENUM('city_major', 'city_medium', 'city_small', 'gate', 'fort', 'wilderness', 'market') NOT NULL COMMENT '城市类型',

  faction_id VARCHAR(50) NULL COMMENT '所属势力ID（NULL=中立）',

  jun_id VARCHAR(64) NULL COMMENT '郡ID，FK → config_jun.jun_id',
  zhou_id VARCHAR(64) NULL COMMENT '州ID，可冗余自郡',
  parent_city_id VARCHAR(50) NULL COMMENT '荒郊/集市所属主城 cities.city_id',

  position_x INT NULL COMMENT '大地图逻辑 X',
  position_y INT NULL COMMENT '大地图逻辑 Y',

  population INT NOT NULL DEFAULT 0 COMMENT '人口',
  commerce INT NOT NULL DEFAULT 0 COMMENT '商业值',
  farming INT NOT NULL DEFAULT 0 COMMENT '农业值',
  military INT NOT NULL DEFAULT 0 COMMENT '军事值',
  culture INT NOT NULL DEFAULT 0 COMMENT '文化值',

  description TEXT NULL COMMENT '城市简介（来自 cities_template.csv description，可选）',

  special_resource_name VARCHAR(50) NULL COMMENT '特色资源名称',
  special_resource_commerce INT NOT NULL DEFAULT 0 COMMENT '特色资源商业加成',
  special_resource_farming INT NOT NULL DEFAULT 0 COMMENT '特色资源农业加成',

  final_commerce INT NOT NULL DEFAULT 0 COMMENT '最终商业值',
  final_farming INT NOT NULL DEFAULT 0 COMMENT '最终农业值',

  lord_player_id VARCHAR(4) NULL COMMENT '长官玩家ID',
  lord_appointed_at DATETIME NULL COMMENT '长官任命时间',

  defense INT NOT NULL DEFAULT 0 COMMENT '防御力',
  player_garrison_capacity INT NOT NULL DEFAULT 0 COMMENT '城内驻军所容量（玩家侧编组/守城槽位规模，非 NPC 支数）',

  npc_garrison JSON NULL COMMENT 'NPC守军：{ units, ledgerAt }',
  npc_garrison_alive INT NOT NULL DEFAULT 0 COMMENT 'NPC守军存活数量',

  status ENUM('neutral', 'contested', 'owned') NOT NULL DEFAULT 'neutral' COMMENT '城市状态',

  is_capital TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否首都',

  is_buildable TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否预设可建造据点空地',
  build_status ENUM('empty', 'building', 'built') NOT NULL DEFAULT 'empty' COMMENT '据点建造状态',
  built_by_player_id VARCHAR(4) NULL COMMENT '据点建造者',
  built_at DATETIME NULL COMMENT '开始建造时间',
  build_complete_at DATETIME NULL COMMENT '预计建造完成时间',
  custom_name VARCHAR(20) NULL COMMENT '据点自定义名：1～3 汉字，建成后不可改',

  buildings_state JSON NULL COMMENT '城内建筑运行态（主殿/三公/太学等）',

  FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE SET NULL,
  FOREIGN KEY (lord_player_id) REFERENCES players(player_id) ON DELETE SET NULL,
  FOREIGN KEY (built_by_player_id) REFERENCES players(player_id) ON DELETE SET NULL,
  FOREIGN KEY (parent_city_id) REFERENCES cities(city_id) ON DELETE SET NULL,

  INDEX idx_season (season),
  INDEX idx_faction (faction_id),
  INDEX idx_city_type (city_type),
  INDEX idx_status (status),
  INDEX idx_jun (jun_id),
  INDEX idx_parent_city (parent_city_id),
  INDEX idx_lord (lord_player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='城市运行时数据表';

SET FOREIGN_KEY_CHECKS = 1;
