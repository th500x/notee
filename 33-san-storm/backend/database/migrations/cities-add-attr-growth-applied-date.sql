-- 城属性日成长幂等标记（13-1 §5.5 · 15-2）
-- 已归属城每日 0:00 成长后写入 CURDATE；易主当日写入以免同日再涨

ALTER TABLE cities
  ADD COLUMN attr_growth_applied_date DATE NULL
    COMMENT '城属性日成长已应用的服务器日历日（CURDATE）' AFTER defense;

-- 上线当日不立刻补涨：已有城视为「今日已处理」
UPDATE cities SET attr_growth_applied_date = CURDATE() WHERE attr_growth_applied_date IS NULL;
