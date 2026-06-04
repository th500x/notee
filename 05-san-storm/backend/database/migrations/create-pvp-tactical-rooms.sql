-- PVP 战术对决房间表（17-5-DUEL_SYSTEM §12.3；17-5-2 步骤 2）
-- 持久化「邀战 → 双方就绪 → 推演 → 结算」房间状态机；多实例部署用 DB 行锁取代单进程 pvpService 内存。
-- canonical 空间：side a = player_a（邀战方）、side b = player_b（应战方）；视角镜像在客户端完成（§12.4）。
-- 安全重复执行：CREATE TABLE IF NOT EXISTS。

CREATE TABLE IF NOT EXISTS pvp_tactical_rooms (
  room_id VARCHAR(50) PRIMARY KEY COMMENT '房间ID（服务端生成，形如 ptr_{时间戳}_{短随机}）',
  season VARCHAR(50) NULL COMMENT '赛季ID（可选；与 cities.season / config_* 一致，如 san_1）',

  player_a_id VARCHAR(4) NOT NULL COMMENT '邀战方 player_id（canonical side a）',
  player_b_id VARCHAR(4) NOT NULL COMMENT '应战方 player_id（canonical side b）',
  canonical_attacker_id VARCHAR(4) NOT NULL COMMENT '推演视角「攻方」player_id（MVP = player_a）',

  duel_map_id VARCHAR(64) NULL COMMENT '对决地图固化 id（catalog DUEL_MAP_POOL_IDS 之一）',
  map_seed BIGINT NULL COMMENT '地图随机种子（暂以 preset 内嵌 seed 为准，预留覆盖）',

  lineup_snapshot_json LONGTEXT NULL COMMENT '开战瞬间双方 main_lineup 冻结快照 JSON：{ a:[...], b:[...] }（both_ready 后不可变）',
  battle_seed BIGINT NULL COMMENT '推演 RNG 种子（hashSeed([room_id, player_a, player_b])）',

  event_seq INT NOT NULL DEFAULT 0 COMMENT '已追加 pvp_tactical_room_events 的最大 seq（结算后定格）',

  status ENUM('invited', 'both_ready', 'sim_running', 'resolved', 'cancelled') NOT NULL DEFAULT 'invited'
    COMMENT 'invited=邀战待应战；both_ready=双方门闸通过、快照已锁；sim_running=推演中；resolved=已结算；cancelled=作废',

  winner_player_id VARCHAR(4) NULL COMMENT '结算后胜方 player_id（平局为 NULL）',
  winner_side ENUM('a', 'b') NULL COMMENT '结算后胜方 canonical side（平局为 NULL）',
  battle_id_a VARCHAR(80) NULL COMMENT 'player_a 视角战报 battles.battle_id',
  battle_id_b VARCHAR(80) NULL COMMENT 'player_b 视角战报 battles.battle_id',

  player_a_last_event_poll_at DATETIME NULL COMMENT 'player_a 最近拉取 events / heartbeat 时间（在线判定，§12.7）',
  player_b_last_event_poll_at DATETIME NULL COMMENT 'player_b 最近拉取 events / heartbeat 时间（在线判定，§12.7）',

  cancel_reason VARCHAR(64) NULL COMMENT '作废原因（timeout / withdraw / sim_failed 等）',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '邀战创建时间',
  accepted_at DATETIME NULL COMMENT '双方就绪（both_ready）时间',
  sim_started_at DATETIME NULL COMMENT '进入 sim_running 时间',
  resolved_at DATETIME NULL COMMENT '结算（resolved）时间',
  expires_at DATETIME NULL COMMENT '邀战超时时间（invited 阶段倒计时）',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行更新时间',

  FOREIGN KEY (player_a_id) REFERENCES players(player_id) ON DELETE CASCADE,
  FOREIGN KEY (player_b_id) REFERENCES players(player_id) ON DELETE CASCADE,

  INDEX idx_ptr_player_a (player_a_id, status),
  INDEX idx_ptr_player_b (player_b_id, status),
  INDEX idx_ptr_status (status),
  INDEX idx_ptr_battle_a (battle_id_a),
  INDEX idx_ptr_battle_b (battle_id_b)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='PVP 战术对决房间（17-5 §12.3）';
