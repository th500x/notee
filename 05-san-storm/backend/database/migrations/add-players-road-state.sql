-- 玩家道路状态列（01-DATABASE_DESIGN.md §3.2.24「与 players 表的关系」）
-- 覆盖：当前道路位置 / 守门开关 / 势力池垫粮日累计 / 每日免费格配额 / 幂等最近请求。
-- 每日免费格配额（road_move_free_*）为 31-6 §9.1「每日前 50 格减免」落地所需的审计列；
-- 与 reserve 列并列，和 attr_reroll_date / attr_reroll_count 风格一致。

ALTER TABLE players
  ADD COLUMN road_jun_id VARCHAR(64) NULL
    COMMENT '当前所在郡；与 road_encounters.jun_id 一致（31-6 §五）',
  ADD COLUMN road_position_x INT NULL
    COMMENT '当前道路格 X（郡内 gx，与 road_encounters.position_x 同语义）',
  ADD COLUMN road_position_y INT NULL
    COMMENT '当前道路格 Y（郡内 gy，与 road_encounters.position_y 同语义）',
  ADD COLUMN road_intercept TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '道路拦截/开战（守门）：0 关闭、1 开启；31-6 §三',
  ADD COLUMN road_updated_at DATETIME NULL
    COMMENT '最近一次道路格位或 road_intercept 服务端写库时间（节流与对账）',
  ADD COLUMN road_reserve_date DATE NULL
    COMMENT '势力池垫粮日界（31-6 §十）：与 attr_reroll_date 同型；用于跨日重置 road_reserve_used',
  ADD COLUMN road_reserve_used INT NOT NULL DEFAULT 0
    COMMENT '当日已从 factions.reserve_food 为道路行军支出的粮草累计（日上限 500）',
  ADD COLUMN road_move_free_date DATE NULL
    COMMENT '每日免费格日界（31-6 §9.1）：与 road_reserve_date 口径一致',
  ADD COLUMN road_move_free_used INT NOT NULL DEFAULT 0
    COMMENT '当日已消耗的免费格计数（31-6 §9.1 前 50 格免费，溢出按 10 粮/格）',
  ADD COLUMN road_last_request_id VARCHAR(64) NULL
    COMMENT '最近一次道路写操作幂等键（02 §2.1.2「通用约定·幂等」）',
  ADD INDEX idx_players_road_cell (road_jun_id, road_position_x, road_position_y);
