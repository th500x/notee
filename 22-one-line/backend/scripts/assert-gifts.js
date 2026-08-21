/**
 * Offline checks for gift campaign rules. No DB.
 * Usage: node scripts/assert-gifts.js
 */

const assert = require('assert');
const {
  STAMP_ID_RE,
  parseLoginIds,
  assertAudience,
  assertStampId,
  buildPayload,
  publicCampaign,
  sanitizeTitle,
  resolveGiftStampIds,
} = require('../lib/giftRules');

assert.ok(STAMP_ID_RE.test('th_lopburi'));
assert.ok(STAMP_ID_RE.test('th_chiang_mai'));
assert.ok(!STAMP_ID_RE.test('TH_BANGKOK'));
assert.ok(!STAMP_ID_RE.test('lopburi'));
assert.strictEqual(assertStampId('th_bangkok'), 'th_bangkok');

assert.deepStrictEqual(parseLoginIds('ab12, cd34 AB12'), ['AB12', 'CD34']);
assert.deepStrictEqual(parseLoginIds('xy,ABCD'), ['ABCD']);

assert.strictEqual(assertAudience('all'), 'all');
assert.strictEqual(assertAudience('login_ids'), 'login_ids');
assert.throws(() => assertAudience('pass'), (err) => err.code === 'GIFT_AUDIENCE_NOT_READY');
assert.throws(() => assertAudience('honor'), (err) => err.code === 'GIFT_AUDIENCE_NOT_READY');
assert.throws(() => assertAudience('vip'), (err) => err.code === 'GIFT_BAD_AUDIENCE');

const built = buildPayload('stamp', 'th_lopburi');
assert.deepStrictEqual(built, { kind: 'stamp', payload: { stampId: 'th_lopburi' } });
assert.throws(() => buildPayload('stamp_pick', 'x'), (err) => err.code === 'GIFT_KIND_NOT_WIRED');
assert.throws(() => buildPayload('pet', 'Bad Id'), (err) => err.code === 'GIFT_BAD_PET_ID');

const pub = publicCampaign({
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'stamp',
  payload: { stampId: 'th_lopburi' },
});
assert.strictEqual(pub.stampId, 'th_lopburi');
assert.strictEqual(pub.petId, null);
assert.strictEqual(pub.title, null);

assert.strictEqual(sanitizeTitle('  New Year Gift  '), 'New Year Gift');
assert.strictEqual(sanitizeTitle(''), null);
const titled = publicCampaign({
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'stamp',
  payload: { stampId: 'th_lopburi' },
  note: '  New Year Gift  ',
});
assert.strictEqual(titled.title, 'New Year Gift');

assert.deepStrictEqual(resolveGiftStampIds({ series: 'limited', country: 'th' }), ['th_lopburi']);
assert.strictEqual(resolveGiftStampIds({ series: 'region', country: 'TH' }).length, 12);
assert.ok(resolveGiftStampIds({ series: 'region', country: 'th' }).includes('th_bangkok'));
assert.throws(
  () => resolveGiftStampIds({ itemId: 'th_lopburi', series: 'limited', country: 'th' }),
  (err) => err.code === 'GIFT_ID_OR_SERIES'
);
assert.throws(
  () => resolveGiftStampIds({ series: 'limited', country: 'xx' }),
  (err) => err.code === 'GIFT_SERIES_EMPTY'
);

console.log('assert-gifts: ok');
