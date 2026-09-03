-- season_settlements 账号级跨赛季继承封档表（赛季继承 Phase 0.1 · 见 19-3 §5.1 / 19-2）
--
-- 职责：记录某账号从 from_season 切到 to_season 时「封档」的继承内容与卡牌行快照，
--       供新赛季创角后 apply 重建 player_cards。与 season_records（成绩）职责分离，勿合并。
--
-- 字段口径与 19-2 §数据结构 / 60-tables-other §4 完全一致。
-- 排序规则用 utf8mb4_general_ci，与 accounts.id 一致（外键要求两列排序规则相同）。
-- 幂等：CREATE TABLE IF NOT EXISTS，重复执行安全。

CREATE TABLE IF NOT EXISTS season_settlements (
  account_id                 VARCHAR(4)   NOT NULL,
  from_season                VARCHAR(50)  NOT NULL,
  to_season                  VARCHAR(50)  NOT NULL,
  server_id                  VARCHAR(20)  NOT NULL,
  auto_inherited_json        JSON         NOT NULL,
  player_selected_json       JSON         NOT NULL,
  player_cards_snapshot_json JSON         NOT NULL,
  selection_limits_json      JSON         NOT NULL,
  selection_source           ENUM('player','auto_shutdown') NOT NULL,
  status                     ENUM('pending_selection','confirmed','applied') NOT NULL DEFAULT 'pending_selection',
  confirmed_at               DATETIME     NULL,
  applied_at                 DATETIME     NULL,
  created_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, from_season, to_season),
  INDEX idx_season_settlements_server_status (server_id, status),
  INDEX idx_season_settlements_to_season (to_season, status),
  CONSTRAINT fk_season_settlements_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
