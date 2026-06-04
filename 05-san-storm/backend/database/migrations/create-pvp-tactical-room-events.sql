-- PVP 战术对决事件流表（17-5-DUEL_SYSTEM §12.6；17-5-2 步骤 2/5）
-- append-only 结构化事件，供双方在线动画播放与离线全量 replay（afterSeq）；第三阶段手动指令复用同表。
-- 安全重复执行：CREATE TABLE IF NOT EXISTS。

CREATE TABLE IF NOT EXISTS pvp_tactical_room_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '自增主键',
  room_id VARCHAR(50) NOT NULL COMMENT '所属房间 pvp_tactical_rooms.room_id',
  seq INT NOT NULL COMMENT '房间内单调递增事件序号（与内核 events[].seq 一致，自 0 起）',
  type VARCHAR(32) NOT NULL COMMENT '事件类型：BATTLE_START / FORMATION_APPLIED / ROUND_START / MOVE / ATTACK / COUNTER / DAMAGE / UNIT_ELIMINATED / BATTLE_END',
  payload_json LONGTEXT NULL COMMENT '事件负载 JSON（坐标 / instanceId / casualties / crit / dodge / round 等）',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '落库时间',

  UNIQUE KEY uk_room_seq (room_id, seq),
  INDEX idx_ptre_room (room_id, seq),

  FOREIGN KEY (room_id) REFERENCES pvp_tactical_rooms(room_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='PVP 战术对决事件流（17-5 §12.6）';
