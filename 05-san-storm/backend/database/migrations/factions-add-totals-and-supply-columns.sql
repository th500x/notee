-- factions：五维势力标量 + 军需 quota + 档位快照（与 01-DATABASE_DESIGN.md §3.2.10 一致）
-- 列已存在时整条 ALTER 可能报 Duplicate；脚本会 SKIP。

ALTER TABLE factions
  ADD COLUMN total_population BIGINT NOT NULL DEFAULT 0 COMMENT '人口势力标量（均值+城数加成）' AFTER reserve_food,
  ADD COLUMN total_trading BIGINT NOT NULL DEFAULT 0 COMMENT '商业势力标量（均值+城数加成，用 final_trading）' AFTER total_population,
  ADD COLUMN total_farming BIGINT NOT NULL DEFAULT 0 COMMENT '农业势力标量（均值+城数加成，用 final_farming）' AFTER total_trading,
  ADD COLUMN total_military BIGINT NOT NULL DEFAULT 0 COMMENT '军事势力标量（均值+城数加成）' AFTER total_farming,
  ADD COLUMN total_culture BIGINT NOT NULL DEFAULT 0 COMMENT '文化势力标量（均值+城数加成）' AFTER total_military,
  ADD COLUMN reserve_troops_quota_total INT NOT NULL DEFAULT 0 COMMENT '预备役本周期可补充兵力总额度' AFTER total_culture,
  ADD COLUMN reserve_troops_quota_used INT NOT NULL DEFAULT 0 COMMENT '预备役本周期已消耗额度' AFTER reserve_troops_quota_total,
  ADD COLUMN legendary_troop_quota_total INT NOT NULL DEFAULT 0 COMMENT '传奇部队可购买总额度' AFTER reserve_troops_quota_used,
  ADD COLUMN legendary_troop_quota_used INT NOT NULL DEFAULT 0 COMMENT '传奇部队已购买额度' AFTER legendary_troop_quota_total,
  ADD COLUMN legendary_character_quota_total INT NOT NULL DEFAULT 0 COMMENT '传奇将领可购买总额度' AFTER legendary_troop_quota_used,
  ADD COLUMN legendary_character_quota_used INT NOT NULL DEFAULT 0 COMMENT '传奇将领已购买额度' AFTER legendary_character_quota_total,
  ADD COLUMN treasure_quota_total INT NOT NULL DEFAULT 0 COMMENT '宝物卡可购买总额度（占位）' AFTER legendary_character_quota_used,
  ADD COLUMN treasure_quota_used INT NOT NULL DEFAULT 0 COMMENT '宝物卡已购买额度（占位）' AFTER treasure_quota_total,
  ADD COLUMN item_quota_total INT NOT NULL DEFAULT 0 COMMENT '道具卡可购买总额度（占位）' AFTER treasure_quota_used,
  ADD COLUMN item_quota_used INT NOT NULL DEFAULT 0 COMMENT '道具卡已购买额度（占位）' AFTER item_quota_total,
  ADD COLUMN supply_tier_snapshot JSON NULL COMMENT '五大属性档位快照 S~D' AFTER item_quota_used;
