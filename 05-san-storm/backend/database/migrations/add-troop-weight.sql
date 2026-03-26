-- 添加兵力权重字段到部队配置表
-- 等效兵力 = max_troops × troop_weight，用于伤害公式的兵力比例系数计算
-- 默认值1表示普通部队，>1表示精锐小队（如燕云十八 troop_weight=3）

ALTER TABLE config_troops
ADD COLUMN troop_weight INT NOT NULL DEFAULT 1 COMMENT '兵力权重（等效兵力=max_troops×troop_weight）'
AFTER max_troops;
