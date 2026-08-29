/**
 * Offline checks for pour bag blobs. No DB.
 * Usage: node scripts/assert-pour-bag.js
 */

const assert = require('assert');
const {
  assertLedgerBlob,
  assertHistoryBlob,
  assertRevision,
  parseBody,
  publicBag,
  HISTORY_MAX,
} = require('../lib/pourBagRules');

const ID = '11111111-1111-4111-8111-111111111111';

const ledger = JSON.stringify({
  credited: [ID],
  cells: [{ y: 2026, m: 8, k: 'beer', h: 7 }],
});
assert.strictEqual(assertLedgerBlob(ledger), ledger);
assert.strictEqual(assertLedgerBlob(''), '');
assert.throws(() => assertLedgerBlob('{'), (err) => err.code === 'POUR_BAG_BAD_BLOB');
assert.throws(
  () => assertLedgerBlob(JSON.stringify({ credited: [], cells: [], photoUrl: 'x' })),
  (err) => err.code === 'POUR_NO_MEDIA' || err.code === 'POUR_BAG_BAD_BLOB'
);

const record = {
  id: ID,
  outcome: 'Publishable',
  startedTapMs: 1,
  startTakenMs: 2,
  endTakenMs: 3,
  endedTapMs: 4,
  tableName: 'MAN',
  people: 1,
  names: ['MAN'],
  place: 'BKK',
  mood: '',
  stampId: 'th_bangkok',
  kinds: ['beer'],
  bottles: [{ startMl: 500, remainMl: 0, kindId: 'beer' }],
};
const history = JSON.stringify({ v: 1, records: [record] });
assert.strictEqual(assertHistoryBlob(history), history);
assert.strictEqual(assertHistoryBlob(''), '');

const withPhoto = JSON.stringify({
  v: 1,
  records: [{ ...record, startPhotoName: 'start.jpg' }],
});
assert.throws(() => assertHistoryBlob(withPhoto), (err) => err.code === 'POUR_NO_MEDIA' || err.code === 'POUR_BAG_BAD_BLOB');

const legacy = {
  id: 'not-a-uuid',
  outcome: 'Expired',
  startedTapMs: 1,
  startTakenMs: 2,
  endedTapMs: 3,
  tableName: 'MAN',
  people: 4,
  names: [],
  place: '',
  mood: 'late @ the bar',
  stampId: 'bkk',
  syncedPostId: 'post-1',
  kinds: [],
  bottles: [{ startMl: 330, remainMl: 20, kindId: 'beer' }],
};
assert.ok(assertHistoryBlob(JSON.stringify({ v: 1, records: [legacy] })));

const tooMany = {
  v: 1,
  records: Array.from({ length: HISTORY_MAX + 1 }, (_, i) => ({
    ...record,
    id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
  })),
};
const trimmed = JSON.parse(assertHistoryBlob(JSON.stringify(tooMany)));
assert.strictEqual(trimmed.records.length, HISTORY_MAX);

assert.strictEqual(assertRevision(3), 3);
assert.throws(() => assertRevision(0), (err) => err.code === 'POUR_BAG_BAD_REVISION');

const parsed = parseBody({
  ledgerBlob: ledger,
  historyBlob: history,
  keepLast30: false,
  revision: 1,
});
assert.strictEqual(parsed.keepLast30, false);
assert.strictEqual(parsed.revision, 1);

const defaultKeep = parseBody({
  ledgerBlob: '',
  historyBlob: '',
  revision: 1,
});
assert.strictEqual(defaultKeep.keepLast30, true);

const empty = publicBag(null);
assert.strictEqual(empty.revision, 0);
assert.strictEqual(empty.keepLast30, true);
assert.strictEqual(empty.ledgerBlob, null);

console.log('assert-pour-bag: ok');
