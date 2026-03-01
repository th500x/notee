-- 租赁追踪系统数据库初始化脚本

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS notee_rental_tracking 
  DEFAULT CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE notee_rental_tracking;

-- 创建项目表
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(50) PRIMARY KEY COMMENT '项目ID',
  name VARCHAR(255) NOT NULL COMMENT '项目名称',
  description TEXT COMMENT '项目描述',
  password VARCHAR(255) COMMENT '项目密码',
  visible BOOLEAN DEFAULT TRUE COMMENT '是否可见',
  properties JSON COMMENT '房源数据（JSON格式）',
  expenses JSON COMMENT '开支数据（JSON格式）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租赁追踪项目表';

-- 显示表结构
DESCRIBE projects;

-- 显示创建成功信息
SELECT '数据库初始化完成！' AS message;
