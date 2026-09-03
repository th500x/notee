/**
 * 常量定义
 * 
 * @description 定义游戏中使用的所有常量（UI相关、业务枚举等）
 * @module constants
 * @note 配置项请使用 @/config，数据路径已移至 @/services/dataService
 */

// ==================== 稀有度 ====================
export const RARITY = {
  LEGENDARY: 'legendary',
  EPIC: 'epic',
  RARE: 'rare',
  COMMON: 'common',
};

export const RARITY_LABELS = {
  [RARITY.LEGENDARY]: '传说',
  [RARITY.EPIC]: '史诗',
  [RARITY.RARE]: '稀有',
  [RARITY.COMMON]: '普通',
};

export const RARITY_COLORS = {
  [RARITY.LEGENDARY]: '#FFD700',
  [RARITY.EPIC]: '#9C27B0',
  [RARITY.RARE]: '#2196F3',
  [RARITY.COMMON]: '#4CAF50',
};

// ==================== 生涯 ====================
export const STAGE = {
  MAOLU: '茅庐',
  PRIME: '巅峰',
  BUHUO: '不惑',
};

export const STAGE_ICONS = {
  [STAGE.MAOLU]: '🌱',
  [STAGE.PRIME]: '⭐',
  [STAGE.BUHUO]: '🧙',
};

export const STAGE_COLORS = {
  [STAGE.MAOLU]: '#4CAF50',
  [STAGE.PRIME]: '#FFD700',
  [STAGE.BUHUO]: '#9C27B0',
};

// ==================== 属性 ====================
export const ATTRIBUTES = {
  // 特殊属性
  LUCK: 'luck',
  COURAGE: 'courage',
  // 核心五维
  COMMAND: 'command',
  COMBAT: 'combat',
  INTELLIGENCE: 'intelligence',
  POLITICS: 'politics',
  CHARISMA: 'charisma',
  // 动态属性
  MORALE: 'morale',
};

export const ATTRIBUTE_LABELS = {
  [ATTRIBUTES.LUCK]: '运气',
  [ATTRIBUTES.COURAGE]: '勇气',
  [ATTRIBUTES.COMMAND]: '统帅',
  [ATTRIBUTES.COMBAT]: '武力',
  [ATTRIBUTES.INTELLIGENCE]: '智力',
  [ATTRIBUTES.POLITICS]: '政治',
  [ATTRIBUTES.CHARISMA]: '魅力',
  [ATTRIBUTES.MORALE]: '奋战',
};

export const ATTRIBUTE_ICONS = {
  [ATTRIBUTES.LUCK]: '🎲',
  [ATTRIBUTES.COURAGE]: '💪',
  [ATTRIBUTES.COMMAND]: '⚔️',
  [ATTRIBUTES.COMBAT]: '🗡️',
  [ATTRIBUTES.INTELLIGENCE]: '📚',
  [ATTRIBUTES.POLITICS]: '🏛️',
  [ATTRIBUTES.CHARISMA]: '✨',
  [ATTRIBUTES.MORALE]: '🔥',
};

export const ATTRIBUTE_COLORS = {
  [ATTRIBUTES.LUCK]: '#FFD700',
  [ATTRIBUTES.COURAGE]: '#FF4444',
  [ATTRIBUTES.COMMAND]: '#9C27B0',
  [ATTRIBUTES.COMBAT]: '#F44336',
  [ATTRIBUTES.INTELLIGENCE]: '#2196F3',
  [ATTRIBUTES.POLITICS]: '#4CAF50',
  [ATTRIBUTES.CHARISMA]: '#E91E63',
  [ATTRIBUTES.MORALE]: '#FF9800',
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

// ==================== 筛选选项 ====================
export const FILTER_OPTIONS = {
  RARITY: [
    { value: 'all', label: '全部稀有度' },
    { value: RARITY.LEGENDARY, label: '传说' },
    { value: RARITY.EPIC, label: '史诗' },
    { value: RARITY.RARE, label: '稀有' },
    { value: RARITY.COMMON, label: '普通' },
  ],
  STAGE: [
    { value: 'all', label: '全部阶段' },
    { value: STAGE.MAOLU, label: '茅庐' },
    { value: STAGE.PRIME, label: '巅峰' },
    { value: STAGE.BUHUO, label: '不惑' },
  ],
};

// ==================== 排序选项 ====================
export const SORT_OPTIONS = [
  { value: 'id', label: '默认排序' },
  { value: 'combat', label: '武力排序' },
  { value: 'intelligence', label: '智力排序' },
  { value: 'command', label: '统帅排序' },
  { value: 'charisma', label: '魅力排序' },
  { value: 'age', label: '年龄排序' },
];
