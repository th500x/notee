-- 玩家道路状态列（01-database-split/60-tables-other §3.2.24）
-- 覆盖：当前道路位置 / 守门开关 / 势力池垫粮日累计 / 每日免费格配额 / 幂等最近请求。
-- 每日免费格配额（road_move_free_*）为 31-6 §6 / 31-2「每日前 N 格减免」落地所需的审计列（N 见 roadConfig.FREE_MOVES_PER_DAY，当前 300）；
-- 与 reserve 列并列，和 attr_reroll_date / attr_reroll_count 风格一致。

ALTER TABLE players
  ADD COLUMN road_jun_id VARCHAR(64) NULL
    COMMENT '当前所在郡；与 config_jun.jun_id / cities.jun_id 口径一致（31-6 §2）',
  ADD COLUMN road_position_x INT NULL
    COMMENT '当前道路格 X（郡内 gx，与 merged.json 道路层一致）',
  ADD COLUMN road_position_y INT NULL
    COMMENT '当前道路格 Y（郡内 gy）',
  ADD COLUMN road_intercept TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '（已废弃：道路来战/守门随遇敌归档移除，见 road-encounters-drop-archived-feature.sql）',
  ADD COLUMN road_updated_at DATETIME NULL
    COMMENT '最近一次道路格位服务端写库时间（节流与对账）',
  ADD COLUMN road_reserve_date DATE NULL
    COMMENT '势力池垫粮日界（31-6 §6）：与 attr_reroll_date 同型；用于跨日重置 road_reserve_used',
  ADD COLUMN road_reserve_used INT NOT NULL DEFAULT 0
    COMMENT '当日已从 faction_reserve(pool) 垫粮的累计（日上限 500；扣减见 factionReserveService）',
  ADD COLUMN road_move_free_date DATE NULL
    COMMENT '每日免费格日界（31-6 §6）：与 road_reserve_date 口径一致',
  ADD COLUMN road_move_free_used INT NOT NULL DEFAULT 0
    COMMENT '当日已消耗的免费格计数（31-6 §6；免费上限见 roadConfig.FREE_MOVES_PER_DAY）',
  ADD COLUMN road_last_request_id VARCHAR(64) NULL
    COMMENT '最近一次道路写操作幂等键（02 §2.1.2「通用约定·幂等」）',
  ADD INDEX idx_players_road_cell (road_jun_id, road_position_x, road_position_y);
