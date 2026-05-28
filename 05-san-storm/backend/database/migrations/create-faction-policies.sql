-- 势力长效政策表（11-3 faction_policies / 01-database-split §3.2.10b）
-- 与 `factions` 同 `faction_*` 族；类目用 `policy_category` 列区分（四类）。
-- 唯一约束：`(faction_id, policy_category)` —— 每势力每类目至多一行。
-- 提案审计：**不建** `faction_policy_proposals`；以 `[passiveApproval]` 结构化日志 + 本表 `last_outcome*` / `next_eligible_at` 表达。
-- 依赖：`factions` 已存在。
-- 幂等：CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS faction_policies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  faction_id VARCHAR(64) NOT NULL COMMENT '势力 id → factions.id',
  policy_category ENUM(
    'ration_bonus',
    'siege_reward',
    'recruit',
    'domestic_goal'
  ) NOT NULL COMMENT '长效政策类目（11-3 §3）',
  config_json JSON NOT NULL COMMENT '类目参数：粮饷 Bonus%、城战个人份额%、招贤段、内政五选一等',
  last_outcome ENUM('approved', 'rejected') NULL COMMENT '最近一次提案 · AI 君主审批结果',
  last_outcome_at DATETIME NULL,
  next_eligible_at DATETIME NULL COMMENT '类目 CD 截止（通过 24h / 驳回 12h；11-3 §3.0）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- 不设 FK：与 `wars_pvp` 同口径，避免与存量 factions 排序规则不一致造成 errno 150；引用由服务层校验。
  PRIMARY KEY (id),
  UNIQUE KEY uk_faction_category (faction_id, policy_category),
  KEY idx_faction_id (faction_id),
  KEY idx_next_eligible (next_eligible_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='势力长效政策（11-3 faction_policies）';
