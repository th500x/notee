/**
 * 阶段 A 最小自测：unlockConditionEvaluator + rewardsJsonToRewardString
 * node backend/scripts/_test_unlock_condition_evaluator.cjs
 */

const { evaluateUnlockCondition } = require('../../shared/utils/unlockConditionEvaluator.js');
const { rewardsJsonToRewardString } = require('../services/achievementUnlockService');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const snapshot = {
  metrics: {
    win_battles: 600,
    total_silver_earned: 10000,
    legendary_characters_collected: 3,
  },
  completedExploreEventIds: new Set(['san_1_event_2_1000']),
  tenureDaysByPositionLevel: { '1': 35 },
  hasPremium: true,
};

assert(
  evaluateUnlockCondition({ win_battles: 500 }, snapshot).ok === true,
  'achievement win_battles threshold',
);
assert(
  evaluateUnlockCondition({ win_battles: 9999 }, snapshot).ok === false,
  'achievement below threshold',
);
assert(
  evaluateUnlockCondition(
    { type: 'tutorial_event', event_id: 'san_1_event_2_1000' },
    snapshot,
    { kind: 'title' },
  ).ok === true,
  'title tutorial_event',
);
assert(
  evaluateUnlockCondition(
    { type: 'position_tenure', position_level: 1, min_days: 30 },
    snapshot,
    { kind: 'title' },
  ).ok === true,
  'title position_tenure',
);
assert(
  evaluateUnlockCondition({ has_premium: true }, snapshot, { kind: 'title' }).ok === true,
  'title has_premium flat',
);
assert(
  rewardsJsonToRewardString({ silver: 500, grant_card_ids: ['san_0_title_1_5001'] })
    === 'san_0_title_1_5001;silver:500',
  'rewardsJsonToRewardString',
);

console.log('OK: unlock condition evaluator smoke tests passed');
