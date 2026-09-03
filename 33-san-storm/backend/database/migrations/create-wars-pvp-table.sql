-- PVP 势力战事（17-2）：与 PVE 表 `wars` 分立；攻城主链见 17-3。
-- 命名：snake_case；时间 DATETIME；扩展 JSON；主键 `pvp_war_id` 与业务 ID `san_{赛季}_war_{四位}` 对齐。
-- 依赖：`cities`、`factions` 已存在。
-- 幂等：CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS wars_pvp (
  pvp_war_id VARCHAR(64) PRIMARY KEY COMMENT 'PVP战事ID（如 san_1_war_0001）',

  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如 san_1）',
  server_id VARCHAR(50) NULL COMMENT '服务器ID（与纪念图/多服实例对齐；可空）',

  war_name VARCHAR(100) NOT NULL COMMENT '战事展示名（如 南阳之战）',
  war_type ENUM('siege', 'defense', 'field') NOT NULL DEFAULT 'siege' COMMENT '战事类型；PVP 攻城主体为 siege',

  target_city_id VARCHAR(50) NOT NULL COMMENT '目标城市ID → cities.city_id',
  target_city_name VARCHAR(100) NOT NULL COMMENT '目标城展示名（冗余）',

  attacker_faction_id VARCHAR(50) NOT NULL COMMENT '攻方势力 → factions.id',
  attacker_faction_name VARCHAR(100) NULL COMMENT '攻方势力名（冗余）',
  defender_faction_id VARCHAR(50) NOT NULL COMMENT '守方势力 → factions.id',
  defender_faction_name VARCHAR(100) NULL COMMENT '守方势力名（冗余）',

  attacker_war_morale INT NULL DEFAULT NULL COMMENT '攻方战事竞态士气 0～120（与 defender 之和恒120；落营激活写入）',
  defender_war_morale INT NULL DEFAULT NULL COMMENT '守方战事竞态士气 0～120',

  status ENUM('pending', 'active', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending'
    COMMENT 'pending=已创建待开打；active；completed；failed；cancelled',

  winner_faction_id VARCHAR(50) NULL COMMENT '获胜势力（终局写入）→ factions.id',
  victory_condition VARCHAR(64) NULL COMMENT '终局条件代码：capture_city | eliminate_attacker_base_camp | hold_city | war_morale_race | timeout 等',

  base_camp JSON NULL COMMENT '攻方城外大本营：锚格、朝向、占用格、NPC总支/存活、贴图键等（见 17-2 实现计划 §1.6a）',
  side_stats JSON NULL COMMENT '攻守双方累计战况摘要（场次、胜负、杀伤等，便于列表/面板）',
  duel_history JSON NULL COMMENT '主将对决摘要（17-4；未实装前可空）',

  start_time DATETIME NULL COMMENT '战事计时起点（自然时；单场≤24h 与 11-3 对齐）',
  end_time DATETIME NULL COMMENT '战事结束时间',
  settled_at DATETIME NULL COMMENT '战事结算写入时间',

  settlement_phase ENUM('none', 'placeholder', 'final') NOT NULL DEFAULT 'none'
    COMMENT '终局结算阶段：none→占位展示→final（与纪念图册战事功能同属第二阶段）',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- 不设 FK：避免与存量 cities/factions 排序规则/定义不一致导致 errno 150；引用由服务层校验。
  INDEX idx_season (season),
  INDEX idx_server (server_id),
  INDEX idx_target_city (target_city_id),
  INDEX idx_status (status),
  INDEX idx_target_status (target_city_id, status),
  INDEX idx_attacker_faction (attacker_faction_id),
  INDEX idx_defender_faction (defender_faction_id),
  INDEX idx_end_time (end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='PVP势力战事（17-2 wars_pvp）';
