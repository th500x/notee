/**
 * Offline checks for lyric proposal payloads. No DB.
 * Usage: node scripts/assert-lyric-proposals.js
 */

const assert = require('assert');
const { BATCH_MAX, FIELD_MAX, DAY_MAX, assertSongs } = require('../lib/lyricProposalRules');

assert.strictEqual(BATCH_MAX, 5);
assert.strictEqual(FIELD_MAX, 80);
assert.strictEqual(DAY_MAX, 20);

const one = assertSongs({ songs: [{ title: '  青衣  ', artist: ' 可楼 ' }] });
assert.deepStrictEqual(one, [{ title: '青衣', artist: '可楼' }]);

const skipBlank = assertSongs({
  songs: [{ title: '  ' }, { title: '霜雪千年', artist: '' }],
});
assert.deepStrictEqual(skipBlank, [{ title: '霜雪千年', artist: null }]);

assert.throws(() => assertSongs(null), (err) => err.code === 'LYRIC_PROPOSAL_BAD_BODY');
assert.throws(() => assertSongs({ songs: [] }), (err) => err.code === 'LYRIC_PROPOSAL_NEED_TITLE');
assert.throws(
  () => assertSongs({ songs: [{ title: 'a' }, { title: 'b' }, { title: 'c' }, { title: 'd' }, { title: 'e' }, { title: 'f' }] }),
  (err) => err.code === 'LYRIC_PROPOSAL_BATCH_MAX'
);
assert.throws(
  () => assertSongs({ songs: [{ title: 'https://youtu.be/x' }] }),
  (err) => err.code === 'LYRIC_PROPOSAL_LINK'
);
assert.throws(
  () => assertSongs({ songs: [{ title: 'x'.repeat(FIELD_MAX + 1) }] }),
  (err) => err.code === 'LYRIC_PROPOSAL_TOO_LONG'
);

console.log('assert-lyric-proposals: ok');
