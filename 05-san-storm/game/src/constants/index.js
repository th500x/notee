/**
 * 应用常量定义
 * 统一管理所有魔法数字和字符串常量
 */

// 存储键名
export const STORAGE_KEYS = {
  ADMIN_TOKEN: 'notee-admin-token',     // 管理员Token（统一认证）
  TOKEN_EXPIRY: 'notee-token-expiry'    // Token过期时间
};

// Token配置
export const TOKEN_DURATION = 30 * 24 * 60 * 60 * 1000;  // 30天（毫秒）

// API配置
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  TIMEOUT: 30000  // 30秒超时
};
