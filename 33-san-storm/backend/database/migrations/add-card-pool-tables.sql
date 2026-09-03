-- 卡池抽取记录表（临时数据，14天过期）
-- 临时模拟方案，未来迁移到正式势力抽卡系统时只需修改概率计算逻辑

CREATE TABLE IF NOT EXISTS temp_card_pool_draws (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  pool_type ENUM('troop', 'character') NOT NULL COMMENT '卡池类型（troop=部队卡池, character=将领卡池）',
  
  -- 抽取结果
  rarity ENUM('common', 'rare', 'epic', 'legendary') NOT NULL COMMENT '抽到的稀有度',
  card_id VARCHAR(50) NULL COMMENT '抽到的卡牌配置ID',
  compensated BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否转为补偿（重复将领/部队超限）',
  
  -- 保底计数（每行记录当前累计值，查询时取最新一条）
  pity_count INT NOT NULL DEFAULT 0 COMMENT '本次抽取后的保底计数（legendary时重置为0）',
  
  -- 时间
  drawn_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '抽取时间',
  expires_at DATETIME NOT NULL COMMENT '过期时间（drawn_at + 14天）',
  
  INDEX idx_player_pool_date (player_id, pool_type, drawn_at),
  INDEX idx_expires (expires_at),
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卡池抽取记录表（临时数据，14天过期）';
