-- 卡池半天窗双通道：silver=银两十连；badge=真三徽章抽（NULL 旧数据视为 silver）
ALTER TABLE temp_card_pool_draws
  ADD COLUMN draw_channel VARCHAR(16) NULL DEFAULT NULL
    COMMENT 'silver|badge；NULL=旧数据按银两通道计'
    AFTER quota_weight;
