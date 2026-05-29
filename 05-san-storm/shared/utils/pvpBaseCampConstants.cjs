/** 攻方大本营 NPC 支数 = 目标城满编 NPC 总支 × 本比例（17-3 §6）。 */
const BASE_CAMP_NPC_RATIO_TO_FULL_GARRISON = 1.5;

/** 守方攻打攻方大本营时，出征粮草 = 常规出征消耗 × 本倍数（17-3 §8 / 17-4 §4.4）。 */
const BASE_CAMP_SIEGE_FOOD_COST_MULTIPLIER = 2;

module.exports = {
  BASE_CAMP_NPC_RATIO_TO_FULL_GARRISON,
  BASE_CAMP_SIEGE_FOOD_COST_MULTIPLIER,
};
