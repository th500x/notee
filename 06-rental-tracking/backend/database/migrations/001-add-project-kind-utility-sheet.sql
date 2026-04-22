-- 水电单：项目类型 + 表格 JSON（UTF-8 无 BOM）
-- 在已存在的库上执行一次；新库请使用更新后的 init-database.sql
--
-- 不要执行: node 本文件.sql（Node 无法运行 SQL）
-- 任选其一:
--   1) 在 06-rental-tracking 目录: node backend/scripts/apply-utility-bill-migration.js
--      或在 backend 目录: npm run migrate:utility
--   2) 用 phpMyAdmin / mysql 客户端打开本文件并执行下方 ALTER

ALTER TABLE projects
  ADD COLUMN project_kind VARCHAR(20) NOT NULL DEFAULT 'rental' COMMENT 'rental | utility' AFTER visible,
  ADD COLUMN utility_sheet JSON NULL COMMENT 'utility bill sheet JSON' AFTER expenses;
