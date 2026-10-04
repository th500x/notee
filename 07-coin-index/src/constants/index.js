/**
 * 常量定义
 * 集中管理所有魔法数字和配置常量
 */

// 年份范围：MIN 为锚点年；MAX/DEFAULT 由 weekCalculator.getConfiguredYearRange() 随「今天」自动延伸
export const YEAR_RANGE = {
  MIN: 2025,
  /** @deprecated 请用 getConfiguredYearRange().max；保留仅为旧引用兜底 */
  MAX: 2026,
  /** @deprecated 请用 getConfiguredYearRange().default */
  DEFAULT: 2026,
}

// 周数限制
export const WEEK_LIMITS = {
  STANDARD_WEEKS: 52,
  MAX_WEEKS: 53,
  MIN_WEEK: 1
}

// 交易信号阈值
export const TRADING_SIGNALS = {
  BUY_THRESHOLD: 4, // 个人评级 >= 4 时买入
  SELL_THRESHOLD: -4, // 个人评级 <= -4 时卖出
  TAKE_PROFIT_USD: 500, // 止盈：价差达此金额（USD/ETH）即结算
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

// T0「必」三道门（不计入 personalRating）
export const T0_MUST_RULES = {
  MIN_EXTREME_SCORE_COUNT: 4,
  TAIL_PERCENT: 20,
  Z_THRESHOLD: 1,
  MIN_SAME_SIDE_SAMPLE: 8,
  LOOKBACK_WEEKS: 52
}

// T1「荐」：偏短路径标签（不计入 personalRating；与 T0 互斥，有必则不荐）
// 成功口径（设计/回测用）：开仓后 ≤ SUCCESS_HOLD_WEEKS 周触及 TAKE_PROFIT_USD 止盈
export const T1_RECOMMEND_RULES = {
  BUY_RATING_MIN: 4,
  SELL_RATING_MAX: -4,
  BUY_FNG_MIN: 25,
  BUY_FNG_MAX: 55,
  BUY_MAYER_MIN: 0.88,
  SELL_MAYER_MIN: 1.2,
  SUCCESS_HOLD_WEEKS: 8,
  TAKE_PROFIT_USD: 500,
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
  PRODUCTION: '/07-coin-index/weeklyData.json',
  PRODUCTION_META: '/07-coin-index/weeklyData.meta.json',
  DEV_ROOT: '/weeklyData.json',
  DEV_META: '/weeklyData.meta.json',
  DEV_RELATIVE: './weeklyData.json',
  DEV_RELATIVE_META: './weeklyData.meta.json'
}

// 仅 2025-W53 为硬编码锚点；2026 起由上一年最后一周连推（见 weekCalculator）
export const SPECIAL_WEEKS = {
  '2025-W53': {
    start: new Date(2025, 11, 29), // 12月29日
    end: new Date(2026, 0, 4), // 1月4日
  },
}

// 格式化配置
export const FORMAT = {
  WEEK_ID_PATTERN: /^(\d{4})-W(\d{2})$/,
  DATE_LOCALE: 'zh-CN'
}
