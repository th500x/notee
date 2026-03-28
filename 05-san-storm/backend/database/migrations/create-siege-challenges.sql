-- 攻城PVP挑战表（实时对战匹配）
-- 攻城方发起挑战 → 防守方响应 → 进入战斗或超时自动战斗

CREATE TABLE IF NOT EXISTS siege_challenges (
  challenge_id VARCHAR(50) PRIMARY KEY COMMENT '挑战ID',
  war_id VARCHAR(50) NOT NULL COMMENT '关联战事ID',
  city_id VARCHAR(50) NOT NULL COMMENT '目标城市ID',

  -- 攻城方
  attacker_id VARCHAR(4) NOT NULL COMMENT '攻城方玩家ID',
  attacker_faction VARCHAR(50) NOT NULL COMMENT '攻城方势力ID',

  -- 防守方
  defender_id VARCHAR(4) NOT NULL COMMENT '防守方玩家ID',
  defender_garrison_slot INT NOT NULL COMMENT '防守方驻守槽位编号',

  -- 状态
  status ENUM('pending', 'accepted', 'timeout', 'completed') DEFAULT 'pending' COMMENT '挑战状态',
  
  -- 等待时间（秒）
  wait_seconds INT DEFAULT 20 COMMENT '等待秒数（游戏内10秒，不在游戏内20秒）',

  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（挑战发起）',
  expires_at DATETIME NOT NULL COMMENT '过期时间（created_at + wait_seconds）',
  accepted_at DATETIME COMMENT '防守方接受时间',
  completed_at DATETIME COMMENT '战斗完成时间',

  -- 战斗结果
  result ENUM('attacker_win', 'defender_win') COMMENT '战斗结果',

  INDEX idx_defender_pending (defender_id, status),
  INDEX idx_city_active (city_id, status),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='攻城PVP挑战表';
