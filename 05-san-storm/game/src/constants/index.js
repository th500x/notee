/**
 * 应用常量定义
 * 统一管理所有魔法数字和字符串常量
 */

// ==================== 存储键名 ====================
export const STORAGE_KEYS = {
  ADMIN_TOKEN: 'notee-admin-token',     // 管理员Token（统一认证）
  TOKEN_EXPIRY: 'notee-token-expiry'    // Token过期时间
};

// ==================== Token配置 ====================
export const TOKEN_DURATION = 30 * 24 * 60 * 60 * 1000;  // 30天（毫秒）

// ==================== API配置 ====================
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3005/api',
  // 管理员认证走主页后端（3001端口），和06项目共享同一套认证
  AUTH_BASE_URL: import.meta.env.VITE_AUTH_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001'),
  TIMEOUT: 30000  // 30秒超时
};

// ==================== 稀有度 ====================
export const RARITY = {
  CORE: 'core',
  LEGENDARY: 'legendary',
  EPIC: 'epic',
  RARE: 'rare',
  COMMON: 'common',
};

export const RARITY_LABELS = {
  [RARITY.CORE]: '核心',
  [RARITY.LEGENDARY]: '传奇',
  [RARITY.EPIC]: '史诗',
  [RARITY.RARE]: '稀有',
  [RARITY.COMMON]: '普通',
};

export const RARITY_COLORS = {
  [RARITY.CORE]: '#FFD700',
  [RARITY.LEGENDARY]: '#FF8C00',
  [RARITY.EPIC]: '#9C27B0',
  [RARITY.RARE]: '#2196F3',
  [RARITY.COMMON]: '#9E9E9E',
};

// ==================== 服务器状态 ====================
export const SERVER_STATUS = {
  IDLE: 'idle',
  POPULAR: 'popular',
  CROWDED: 'crowded',
  FULL: 'full',
  MAINTENANCE: 'maintenance',
};

export const SERVER_STATUS_LABELS = {
  [SERVER_STATUS.IDLE]: '空闲',
  [SERVER_STATUS.POPULAR]: '热门',
  [SERVER_STATUS.CROWDED]: '拥挤',
  [SERVER_STATUS.FULL]: '满编',
  [SERVER_STATUS.MAINTENANCE]: '维护',
};

export const SERVER_STATUS_ICONS = {
  [SERVER_STATUS.IDLE]: '🟢',
  [SERVER_STATUS.POPULAR]: '🟡',
  [SERVER_STATUS.CROWDED]: '🟠',
  [SERVER_STATUS.FULL]: '🔴',
  [SERVER_STATUS.MAINTENANCE]: '⚫',
};

export const SERVER_STATUS_COLORS = {
  [SERVER_STATUS.IDLE]: '#4CAF50',
  [SERVER_STATUS.POPULAR]: '#FFC107',
  [SERVER_STATUS.CROWDED]: '#FF9800',
  [SERVER_STATUS.FULL]: '#F44336',
  [SERVER_STATUS.MAINTENANCE]: '#9E9E9E',
};

// ==================== 赛季 ====================
export const SEASONS = {
  SAN_1: 'san_1',
  SAN_2: 'san_2',
  SAN_3: 'san_3',
};

export const SEASON_LABELS = {
  [SEASONS.S1]: 'S1 七雄争霸',
  [SEASONS.S2]: 'S2 赤壁之战',
  [SEASONS.S3]: 'S3 三分天下',
};
