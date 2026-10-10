/**
 * Offline checks for favorite id lists. No DB.
 * Usage: node scripts/assert-lyric-favorites.js
 */

const assert = require('assert');
const {
  parseBody,
  publicBag,
  encodeBlob,
  assertIds,
} = require('../lib/lyricFavoriteRules');

const song = 'album:2000:小镇姑娘:陶喆';

try {
  assertIds([song, '']);
  assert.fail('blank id must throw');
} catch (err) {
  assert.strictEqual(err.code, 'LYRIC_FAVORITES_BAD');
}

assert.deepStrictEqual(assertIds([song, song, ` ${song}`]), [song]);

const parsed = parseBody({ ids: [song, 'album:2001:爱在西元前:周杰伦'], revision: 2 });
assert.strictEqual(parsed.revision, 2);
assert.deepStrictEqual(parsed.ids, [song, 'album:2001:爱在西元前:周杰伦']);

const row = publicBag({ bag_blob: encodeBlob(parsed.ids), revision: 2 });
assert.deepStrictEqual(row.ids, parsed.ids);
assert.strictEqual(row.revision, 2);
assert.deepStrictEqual(publicBag(null), { ids: [], revision: 0 });

try {
  parseBody({ ids: [song], revision: 0 });
  assert.fail('revision 0 must throw');
} catch (err) {
  assert.strictEqual(err.code, 'LYRIC_FAVORITES_BAD_REVISION');
}

console.log('assert-lyric-favorites ok');
