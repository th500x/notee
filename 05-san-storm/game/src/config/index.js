/**
 * 应用配置
 * 
 * @description 统一管理应用的所有配置项
 * @module config
 */

// ==================== API 配置 ====================
export const apiConfig = {
  // API 基础路径
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002',
  
  // 请求超时时间（毫秒）
  timeout: 30000,
  
  // 重试次数
  retryCount: 3,
  
  // 重试延迟（毫秒）
  retryDelay: 1000,
};

// ==================== 游戏配置 ====================
export const gameConfig = {
  // 服务器配置
  maxPlayersPerServer: 500,
  serverIdleThreshold: 100,
  serverCrowdedThreshold: 400,
  
  // 编组配置
  maxFormations: 6,
  maxTroopsPerFormation: 1,
  
  // 属性范围
  attributeMin: 0.0,
  attributeMax: 10.0,
  moraleMin: 0,
  moraleMax: 100,
  
  // 年龄范围
  ageMaoluMax: 24,
  agePrimeMin: 25,
  agePrimeMax: 45,
  ageBuhuoMin: 46,
};

// ==================== 功能开关 ====================
export const featureFlags = {
  // 是否启用模拟数据
  enableMockData: import.meta.env.DEV,
  
  // 是否启用日志
  enableLogging: import.meta.env.DEV,
  
  // 是否启用调试模式
  enableDebug: import.meta.env.DEV,
  
  // 是否启用性能监控
  enablePerformanceMonitoring: false,
};

// ==================== 认证配置 ====================
export const authConfig = {
  // Token 有效期（毫秒）
  tokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30天
  
  // 密码尝试限制
  maxPasswordAttempts: 5,
  lockoutDuration: 10 * 60 * 1000, // 10分钟
};

// ==================== 数据配置 ====================
export const dataConfig = {
  // 数据基础路径
  basePath: import.meta.env.BASE_URL || '/',
  
  // 缓存配置
  cacheEnabled: true,
  cacheDuration: 5 * 60 * 1000, // 5分钟
  
  // 数据加载配置
  parallelLoading: true,
  lazyLoading: true,
};

// ==================== UI 配置 ====================
export const uiConfig = {
  // 分页配置
  itemsPerPage: 20,
  
  // 动画配置
  animationDuration: 300,
  
  // 通知配置
  notificationDuration: 3000,
  
  // 移动端断点
  mobileBreakpoint: 768,
  tabletBreakpoint: 1024,
};

// ==================== 导出统一配置对象 ====================
export const config = {
  api: apiConfig,
  game: gameConfig,
  features: featureFlags,
  auth: authConfig,
  data: dataConfig,
  ui: uiConfig,
};

// 默认导出
export default config;
