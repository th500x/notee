-- 租赁追踪系统数据库初始化脚本

-- 创建数据库（如果不存在）；与文档及 backend/.env 默认 DB_NAME 一致（名称以数字开头需反引号）
CREATE DATABASE IF NOT EXISTS `06_rental_tracking`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE `06_rental_tracking`;

-- 创建项目表
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(50) PRIMARY KEY COMMENT '项目ID',
  name VARCHAR(255) NOT NULL COMMENT '项目名称',
  description TEXT COMMENT '项目描述',
  password VARCHAR(255) COMMENT '项目密码',
  visible BOOLEAN DEFAULT TRUE COMMENT '是否可见',
  project_kind VARCHAR(20) NOT NULL DEFAULT 'rental' COMMENT 'rental | utility',
  properties JSON COMMENT '房源数据（JSON格式）',
  property_groups JSON COMMENT '房源分组（JSON格式）',
  expenses JSON COMMENT '开支数据（JSON格式）',
  utility_sheet JSON NULL COMMENT '水电单表格数据（仅 utility）',
  version INT DEFAULT 1 COMMENT '数据版本号',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租赁追踪项目表';

-- 显示表结构
DESCRIBE projects;

-- 显示创建成功信息
SELECT '数据库初始化完成！' AS message;
