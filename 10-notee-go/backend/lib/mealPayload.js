/**
 * Meal sitting payload (Table Check). Stored in posts.pour; response field is `meal`.
 * Same table / names / place / duration gates as pour. No bottles.
 */

const { httpError } = require('./httpError');
const { assertWeightedText } = require('./postBody');
const {
  PLACE_BUDGET,
  PEOPLE_MIN,
  PEOPLE_MAX,
  DURATION_MAX_SEC,
  POUR_TEST_SHORT_PUBLISH_GAP,
  durationMinSec,
  rejectBannedKeys,
  assertInt,
  assertTableName,
  assertNames,
} = require('./pourPayload');

const MEAL_TYPES = new Set([
  'fast',
  'western',
  'thai',
  'chinese',
  'korean',
  'japanese',
  'bbq',
]);
const CURRENCIES = new Set(['thb', 'cny', 'usd']);
const PRICE_MAX = 999999;

const MEAL_KEYS = new Set([
  'tableName',
  'people',
  'names',
  'durationSec',
  'place',
  'mealType',
  'currency',
  'price',
]);

/**
 * @returns {{
 *   tableName: string,
 *   people: number,
 *   names: string[],
 *   durationSec: number,
 *   place: string,
 *   mealType: string,
 *   currency: string,
 *   price: number|null
 * }}
 */
function assertMealPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw httpError(400, 'meal 无效', 'BAD_MEAL');
  }
  rejectBannedKeys(raw);
  for (const key of Object.keys(raw)) {
    if (!MEAL_KEYS.has(key)) {
      throw httpError(400, 'meal 含未知字段', 'BAD_MEAL');
    }
  }

  const tableName = assertTableName(raw.tableName);
  const people = assertInt(raw.people, PEOPLE_MIN, PEOPLE_MAX, 'BAD_MEAL', '人数无效');
  const names = assertNames(raw.names, people);
  const minSec = durationMinSec();
  const durationSec = assertInt(
    raw.durationSec,
    minSec,
    DURATION_MAX_SEC,
    'BAD_MEAL',
    POUR_TEST_SHORT_PUBLISH_GAP ? '时长须在 5 分钟–6 小时' : '时长须在 30 分钟–6 小时'
  );
  const place = assertWeightedText(raw.place, PLACE_BUDGET, { allowEmpty: false });
  const mealType = typeof raw.mealType === 'string' ? raw.mealType.trim() : '';
  if (!MEAL_TYPES.has(mealType)) {
    throw httpError(400, '餐型无效', 'BAD_MEAL');
  }
  const currency = typeof raw.currency === 'string' ? raw.currency.trim().toLowerCase() : '';
  if (!CURRENCIES.has(currency)) {
    throw httpError(400, '货币无效', 'BAD_MEAL');
  }
  let price = null;
  if (raw.price != null && raw.price !== '') {
    const n = typeof raw.price === 'number' ? raw.price : Number(raw.price);
    if (!Number.isInteger(n) || n < 1 || n > PRICE_MAX) {
      throw httpError(400, '价格无效', 'BAD_MEAL');
    }
    price = n;
  }

  return {
    tableName,
    people,
    names,
    durationSec,
    place,
    mealType,
    currency,
    price,
  };
}

module.exports = {
  MEAL_TYPES,
  CURRENCIES,
  PRICE_MAX,
  assertMealPayload,
};
