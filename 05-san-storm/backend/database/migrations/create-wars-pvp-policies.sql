-- PVP 战事临时政策表（11-3 wars_pvp_policies / 01-database-split §3.2.18b）
-- 仅挂 `wars_pvp`；不挂 PVE `wars`。一场 PVP 战事 1 行。
-- 实装段3 才会真正消费本表；段1 提前建表，避免后续迁移混入业务实装时序中。
-- 依赖：`wars_pvp` 已存在。
-- 幂等：CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS wars_pvp_policies (
  pvp_war_id VARCHAR(64) NOT NULL COMMENT 'PK → wars_pvp.pvp_war_id；一场 PVP 战事一行',

  front_assault_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '前军突击（11-3 §4 / §5）',
  rear_assault_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '后军突击',
  imperial_march_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '御驾亲征',

  config_json JSON NULL COMMENT '开关与扩展参数（与上三列合并维护，便于段3 扩 phase 参数）',
  fees_deducted_json JSON NULL COMMENT '宣战时自 faction_reserve pool 扣费快照（与勾选同事务）',
  phase_snapshot_json JSON NULL COMMENT 'T0 冻结：阶段表、后军 H:00 窗、前/后军剩余进攻配额（M×K）',

  imperial_march_expires_at DATETIME NULL COMMENT '御驾亲征 1h 墙钟到期',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL COMMENT '提前撤销或战事终局收束',

  PRIMARY KEY (pvp_war_id),
  KEY idx_imperial_expires (imperial_march_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='PVP战事临时政策（11-3 wars_pvp_policies）';
