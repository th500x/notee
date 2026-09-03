-- 卡池半天窗计数：按 quota_weight 累加（十连抽 / 部队同次第2张为0）
-- NULL 行仍按 drawn_at 秒级去重（兼容旧数据）

ALTER TABLE temp_card_pool_draws
  ADD COLUMN quota_weight TINYINT NULL DEFAULT NULL
    COMMENT '半天窗计数权重；NULL=旧数据按秒去重'
    AFTER expires_at;
