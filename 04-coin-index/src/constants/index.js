/**
 * 常量定义
 * 集中管理所有魔法数字和配置常量
 */

// 年份范围配置
export const YEAR_RANGE = {
  MIN: 2025,
  MAX: 2026,
  DEFAULT: 2026
}

// 周数限制
export const WEEK_LIMITS = {
  STANDARD_WEEKS: 52,
  MAX_WEEKS: 53,
  MIN_WEEK: 1
}

// 交易信号阈值
export const TRADING_SIGNALS = {
  BUY_THRESHOLD: 4,      // 个人评级 >= 4 时买入
  SELL_THRESHOLD: -4     // 个人评级 <= -4 时卖出
}

// 个人评级等级
export const RATING_LEVELS = {
  EXTREME_BULLISH: 10,   // 极度看多
  BULLISH: 4,            // 看多
  NEUTRAL_HIGH: 3,       // 中性上限
  NEUTRAL_LOW: -3,       // 中性下限
  BEARISH: -9,           // 看空
  EXTREME_BEARISH: -10   // 极度看空
}

// 指标阈值
export const INDICATOR_THRESHOLDS = {
  // 恐惧贪婪指数
  FEAR_GREED: {
    EXTREME_GREED: 75,
    GREED: 55,
    NEUTRAL: 45,
    FEAR: 25
  },
  // 梅耶倍数
  MAYER_MULTIPLE: {
    OVERVALUED: 2.4,
    NORMAL: 1.0
  },
  // Ahr999指标
  AHR999: {
    BOTTOM: 0.45,      // 抄底区间
    DCA: 1.2           // 定投区间上限
  },
  // BTC四年指数
  BTC_FOUR_YEAR: {
    EXTREME_LOW: 0.3,
    LOW: 0.6,
    NORMAL: 1.0,
    HIGH: 1.5
  }
}

// 数据路径配置
export const DATA_PATHS = {
  PRODUCTION: '/04-coin-index/weeklyData.json',
  DEV_ROOT: '/weeklyData.json',
  DEV_RELATIVE: './weeklyData.json'
}

// 特殊周配置（跨年周）
export const SPECIAL_WEEKS = {
  // 2025年W53跨年周
  '2025-W53': {
    start: new Date(2025, 11, 29), // 12月29日
    end: new Date(2026, 0, 4)      // 1月4日
  },
  // 2026年W52跨年周
  '2026-W52': {
    start: new Date(2026, 11, 28), // 12月28日
    end: new Date(2027, 0, 3)      // 1月3日
  }
}

// 2026年特殊周（前4周）
export const SPECIAL_WEEKS_2026 = [
  { start: new Date(2026, 0, 5), end: new Date(2026, 0, 11), num: 1 },   // W1: 01/05-01/11
  { start: new Date(2026, 0, 12), end: new Date(2026, 0, 18), num: 2 },  // W2: 01/12-01/18
  { start: new Date(2026, 0, 19), end: new Date(2026, 0, 25), num: 3 },  // W3: 01/19-01/25
  { start: new Date(2026, 0, 26), end: new Date(2026, 1, 1), num: 4 }    // W4: 01/26-02/01
]

// 格式化配置
export const FORMAT = {
  WEEK_ID_PATTERN: /^(\d{4})-W(\d{2})$/,
  DATE_LOCALE: 'zh-CN'
}
