-- 由 rebuild-local-from-prod-schema.cmd 调用：仅用于本地重建空库
DROP DATABASE IF EXISTS `05_san_storm`;
CREATE DATABASE `05_san_storm` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
