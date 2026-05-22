-- 税费单：projects.tax_sheet（UTF-8 无 BOM）
-- 执行: node backend/scripts/apply-tax-sheet-migration.js
--   或 cd backend && npm run migrate:tax

-- 若库内已有 accounting_sheet，可手工改为 AFTER accounting_sheet；无该列时勿写 AFTER 以免迁移失败
ALTER TABLE projects
  ADD COLUMN tax_sheet JSON NULL COMMENT '税费单 JSON（仅 tax）';
