-- 活动榜 / 日榜：冻结列「贡献增量」（与 frozen_delta_reputation 对称）
-- 若库内仍为 frozen_delta_rep_contrib，请先执行 rename-temp-ranking-frozen-rep-contrib-to-reputation.sql

ALTER TABLE temp_event_ranking
  ADD COLUMN frozen_delta_contribution INT NULL
    COMMENT '冻结：活动期间贡献 earned 增量' AFTER frozen_delta_reputation;
