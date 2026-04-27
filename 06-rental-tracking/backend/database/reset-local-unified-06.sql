-- 本地开发：统一到 06_rental_tracking（删除 rental_tracking 与 06 库内全部数据）
-- 勿在生产环境执行。在 phpMyAdmin 中「全选执行」或: node backend/scripts/reset-local-unified-06.js --yes

DROP DATABASE IF EXISTS `rental_tracking`;
DROP DATABASE IF EXISTS `06_rental_tracking`;

CREATE DATABASE `06_rental_tracking`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `06_rental_tracking`;

CREATE TABLE `projects` (
  `id` VARCHAR(50) NOT NULL COMMENT '项目ID',
  `name` VARCHAR(255) NOT NULL COMMENT '项目名称',
  `description` TEXT COMMENT '项目描述',
  `password` VARCHAR(255) DEFAULT NULL COMMENT '项目密码',
  `visible` BOOLEAN DEFAULT TRUE COMMENT '是否可见',
  `project_kind` VARCHAR(20) NOT NULL DEFAULT 'rental' COMMENT 'rental | utility | accounting',
  `properties` JSON DEFAULT NULL COMMENT '房源数据',
  `property_groups` JSON DEFAULT NULL COMMENT '房源分组',
  `expenses` JSON DEFAULT NULL COMMENT '开支数据',
  `utility_sheet` JSON DEFAULT NULL COMMENT '水电单',
  `accounting_sheet` JSON DEFAULT NULL COMMENT '账目单',
  `version` INT DEFAULT 1 COMMENT '数据版本号',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租赁追踪项目表';

SELECT 'OK: unified to 06_rental_tracking' AS message;
