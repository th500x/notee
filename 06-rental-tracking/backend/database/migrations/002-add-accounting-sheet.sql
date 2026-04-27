-- 账目单：projects.accounting_sheet（UTF-8 无 BOM）
-- 任选其一执行:
--   node backend/scripts/apply-accounting-sheet-migration.js
--   cd backend && npm run migrate:accounting

ALTER TABLE projects
  ADD COLUMN accounting_sheet JSON NULL COMMENT '账目单 JSON（仅 accounting）' AFTER utility_sheet;
