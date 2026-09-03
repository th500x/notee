-- 修复weapon_type字段值
-- 创建日期: 2026-03-17
-- 问题: 之前的迁移将步兵weapon_type设为'sword'，但图片文件名使用'saber'
-- 图片命名规则: troop_{稀有度}_{兵种}_{武器}.png（如 troop_r2_infantry_saber.png）

UPDATE config_troops 
SET weapon_type = 'saber'
WHERE weapon_type = 'sword';
