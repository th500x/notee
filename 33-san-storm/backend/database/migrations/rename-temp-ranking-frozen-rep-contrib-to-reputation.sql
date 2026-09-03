-- 统一冻结列命名：frozen_delta_rep_contrib → frozen_delta_reputation（与 frozen_delta_contribution 对称）
-- 须在 add-temp-ranking-frozen-delta-contribution.sql 之前或之后均可；列已存在时执行本脚本

ALTER TABLE temp_event_ranking
  CHANGE COLUMN frozen_delta_rep_contrib frozen_delta_reputation INT NULL
    COMMENT '冻结：活动期间声望 earned 增量';
