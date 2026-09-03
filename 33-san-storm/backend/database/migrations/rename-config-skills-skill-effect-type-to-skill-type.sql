-- 误用 skill_effect_type 时改回 skill_type（与 CSV/生产一致）
-- 情形 A：仅有 skill_effect_type → CHANGE 为 skill_type
-- 情形 B：两列并存 → 数据并入 skill_type 后 DROP skill_effect_type
-- 情形 C：仅有 skill_type → 由 apply-pending-local-ddl.js 按错误信息跳过

UPDATE config_skills
SET skill_type = skill_effect_type
WHERE skill_effect_type IS NOT NULL
  AND (skill_type IS NULL OR skill_type = '');

ALTER TABLE config_skills DROP COLUMN skill_effect_type;
