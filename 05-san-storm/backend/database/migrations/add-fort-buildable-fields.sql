-- 迁移：cities 表新增据点建造相关字段
-- 执行时间：2026-04
-- 说明：支持玩家在预设位置建造据点，建造者成为首任城主，据点归属势力

-- 1. 是否为可建造预设点（空地，尚未建成）
ALTER TABLE cities
  ADD COLUMN is_buildable TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '是否为可建造预设点（1=预设空地，0=固定城市）'
    AFTER is_capital;

-- 2. 建造状态（仅 is_buildable=1 的据点使用）
ALTER TABLE cities
  ADD COLUMN build_status ENUM('empty','building','built') NOT NULL DEFAULT 'empty'
    COMMENT '建造状态：empty=未建造，building=建造中，built=已建成'
    AFTER is_buildable;

-- 3. 建造者玩家ID
ALTER TABLE cities
  ADD COLUMN built_by_player_id VARCHAR(4) NULL DEFAULT NULL
    COMMENT '建造者玩家ID（首次建造的玩家，据点归属势力）'
    AFTER build_status;

-- 4. 开始建造时间
ALTER TABLE cities
  ADD COLUMN built_at DATETIME NULL DEFAULT NULL
    COMMENT '开始建造时间'
    AFTER built_by_player_id;

-- 5. 预计建造完成时间（现实时间10小时后）
ALTER TABLE cities
  ADD COLUMN build_complete_at DATETIME NULL DEFAULT NULL
    COMMENT '预计建造完成时间（built_at + 10小时）'
    AFTER built_at;

-- 6. 玩家自定义据点名称
ALTER TABLE cities
  ADD COLUMN custom_name VARCHAR(20) NULL DEFAULT NULL
    COMMENT '玩家自定义据点名称（最多10个汉字/20字符，建造时填写）'
    AFTER build_complete_at;

-- 验证
SELECT id, city_name, city_type, is_buildable, build_status, built_by_player_id, built_at, build_complete_at, custom_name
FROM cities
WHERE city_type = 'fort'
LIMIT 5;
