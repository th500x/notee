-- 迁移：移除 cities.region
-- 执行时机：州/郡由 config_zhou、config_jun + cities.jun_id 承载后；本字段为早期模糊「地区」标签。
-- 说明：当前设计阶段无依赖该列的生产数据时可安全执行；若库中曾有数据请先备份并完成映射再 DROP。

ALTER TABLE cities DROP COLUMN region;
