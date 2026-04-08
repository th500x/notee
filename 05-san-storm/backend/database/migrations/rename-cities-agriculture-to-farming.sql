-- 迁移：cities 表「农业」相关列统一命名为 farming（与玩法/CSV 口径一致）
-- 执行时机：无依赖旧列名的生产数据时；执行前请备份。
-- 影响列：agriculture → farming；special_resource_agriculture → special_resource_farming；final_agriculture → final_farming

ALTER TABLE cities
  CHANGE COLUMN agriculture farming INT DEFAULT 0 COMMENT '农业值（关隘/要塞为NULL）',
  CHANGE COLUMN special_resource_agriculture special_resource_farming INT DEFAULT 0 COMMENT '特色资源农业加成（固定+100）',
  CHANGE COLUMN final_agriculture final_farming INT DEFAULT 0 COMMENT '最终农业值（用于资源结算）';
