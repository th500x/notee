-- ==========================================
-- 06-rental-tracking 数据库架构
-- ==========================================
-- 创建日期: 2026-03-03
-- 数据库: MySQL 8.0+ / MariaDB 10.5+
-- 字符集: utf8mb4
-- ==========================================

-- 创建数据库（如果不存在）；库名与 backend/.env 约定一致
CREATE DATABASE IF NOT EXISTS `06_rental_tracking`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE `06_rental_tracking`;

-- ==========================================
-- 项目表 (projects)
-- ==========================================
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(50) PRIMARY KEY COMMENT '项目ID',
  name VARCHAR(255) NOT NULL COMMENT '项目名称',
  description TEXT COMMENT '项目描述',
  password VARCHAR(255) DEFAULT NULL COMMENT '项目密码（bcrypt哈希）',
  visible BOOLEAN DEFAULT TRUE COMMENT '是否可见',
  project_kind VARCHAR(20) NOT NULL DEFAULT 'rental' COMMENT 'rental | utility | accounting',
  properties JSON DEFAULT NULL COMMENT '房源数据（JSON格式）',
  property_groups JSON DEFAULT NULL COMMENT '房源分组数据（JSON格式）',
  expenses JSON DEFAULT NULL COMMENT '开支数据（JSON格式）',
  utility_sheet JSON DEFAULT NULL COMMENT '水电单',
  accounting_sheet JSON DEFAULT NULL COMMENT '账目单（仅 accounting）',
  version INT DEFAULT 1 COMMENT '版本号（用于并发控制）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租赁项目表';

-- ==========================================
-- 插入测试数据（可选）
-- ==========================================
-- INSERT INTO projects (id, name, description, visible, properties, property_groups, expenses, version)
-- VALUES (
--   'test-project-001',
--   '测试项目',
--   '这是一个测试项目，用于验证数据库连接',
--   TRUE,
--   '[]',
--   '{}',
--   '[]',
--   1
-- );

-- ==========================================
-- 验证表创建
-- ==========================================
SHOW TABLES;
DESC projects;

-- ==========================================
-- 完成！
-- ==========================================
-- 数据库创建完成，可以开始使用了。
-- 
-- 数据库名: 06_rental_tracking
-- 表名: projects
-- 
-- 下一步：
-- 1. 安装 mysql2 依赖: npm install mysql2
-- 2. 配置 .env 文件: DB_NAME=06_rental_tracking
-- 3. 水电单等新列：若旧表已存在，可运行 npm run migrate:utility；或本地清空用 npm run db:reset-local
-- ==========================================

