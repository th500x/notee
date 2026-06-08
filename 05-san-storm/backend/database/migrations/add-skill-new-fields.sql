-- 迁移：config_skills 新增字段 + 移除废弃列
-- 执行时间：2026-04
-- 说明：
--   1. 新增 skill_type（技能效果分类，对应 CSV 列 skill_type → JSON skillEffectType）
--   2. 新增 special_effect（特殊效果编码字符串）
--   3. 新增 damage_multiplier（伤害倍率，如 2.5 表示 250%）
--   4. 删除 target_effect（CSV 已移除此字段，由 special_effect 替代）
-- 主/被动（active/passive）不入库，由 skill_id 第三位表达（1/3=主动，2/4=被动）

-- 1. 新增 skill_type（技能效果分类）
ALTER TABLE config_skills
  ADD COLUMN skill_type VARCHAR(30) NULL
    COMMENT '技能效果分类（damage/damage_control/...；纯数值被动为NULL）'
    AFTER skill_name;

-- 2. 新增 special_effect
ALTER TABLE config_skills
  ADD COLUMN special_effect VARCHAR(200) NULL
    COMMENT '特殊效果编码，分号分隔多个效果。格式见 04-2-DATA_TERM_DICTIONARY.md §4'
    AFTER skill_type;

-- 3. 新增 damage_multiplier
ALTER TABLE config_skills
  ADD COLUMN damage_multiplier DECIMAL(4,2) NULL DEFAULT 0.00
    COMMENT '伤害倍率（如 2.50 表示 250%；被动/辅助技能为 0.00）'
    AFTER special_effect;

-- 4. 删除废弃字段 target_effect
ALTER TABLE config_skills
  DROP COLUMN target_effect;

-- 验证
SELECT skill_id, skill_name, skill_type, special_effect, damage_multiplier, target_range, target_count
FROM config_skills LIMIT 3;
