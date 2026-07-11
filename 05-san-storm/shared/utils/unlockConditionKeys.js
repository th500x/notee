/**
 * 称号 / 成就 unlock_conditions 键名与称号 type 枚举（单源）
 * @see docs/00/00-base/04-2-DATA_TERM_DICTIONARY.md §7–7.1
 */

/** 成就：扁平 JSON 键（数值 ≥ 阈值） */
export const ACHIEVEMENT_METRIC_KEYS = {
  WIN_BATTLES: 'win_battles',
  TOTAL_SILVER_EARNED: 'total_silver_earned',
  LEGENDARY_CHARACTERS_COLLECTED: 'legendary_characters_collected',
  TOTAL_EVENTS_COMPLETED: 'total_events_completed',
};

/** 称号：typed unlock_conditions.type */
export const TITLE_UNLOCK_TYPES = {
  TUTORIAL_EVENT: 'tutorial_event',
  POSITION_TENURE: 'position_tenure',
};

/** 称号：扁平布尔键（无 type 包裹） */
export const TITLE_FLAT_KEYS = {
  HAS_PREMIUM: 'has_premium',
};
