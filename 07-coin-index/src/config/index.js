/**
 * 应用配置
 * 集中管理环境变量和应用配置
 */

import { YEAR_RANGE, DATA_PATHS } from '../constants'

export const config = {
  /** 11 API；开发环境走 Vite proxy → 3011 */
  lifeResumeApiBase: String(import.meta.env.VITE_LIFE_RESUME_API_BASE || '/api/life-resume').replace(/\/$/, ''),

  // 数据配置
  data: {
    basePath: import.meta.env.BASE_URL || '/',
    weeklyDataPath: DATA_PATHS.PRODUCTION,
    fallbackPaths: [
      DATA_PATHS.PRODUCTION,
      DATA_PATHS.DEV_ROOT,
      DATA_PATHS.DEV_RELATIVE
    ]
  },
  
  // 年份配置
  years: {
    min: YEAR_RANGE.MIN,
    max: YEAR_RANGE.MAX,
    default: YEAR_RANGE.DEFAULT
  },
  
  // 功能开关
  features: {
    enableMockData: import.meta.env.DEV,      // 开发环境启用模拟数据
    enableLogging: import.meta.env.DEV,       // 开发环境启用日志
    enableDebug: import.meta.env.DEV          // 开发环境启用调试
  },
  
  // 性能配置
  performance: {
    enableParallelLoading: true,              // 启用并行加载
    cacheEnabled: true                        // 启用缓存
  }
}

export default config
