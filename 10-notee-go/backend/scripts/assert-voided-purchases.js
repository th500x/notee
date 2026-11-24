/**
 * Voided-purchase page parsing. No network, no database.
 * Usage: node scripts/assert-voided-purchases.js
 */

const assert = require('assert');
const { readVoidedPage } = require('../lib/playPurchase');

function testEmptyPage() {
  const page = readVoidedPage({});
  assert.deepStrictEqual(page.purchases, []);
  assert.strictEqual(page.nextPageToken, '');
}

function testOnePurchase() {
  const page = readVoidedPage({
    voidedPurchases: [
      { purchaseToken: ' tok-1 ', orderId: 'GPA.1', voidedTimeMillis: '1700000000000' },
    ],
    tokenPagination: { nextPageToken: 'page-2' },
  });
  assert.strictEqual(page.purchases.length, 1);
  assert.strictEqual(page.purchases[0].purchaseToken, 'tok-1');
  assert.strictEqual(page.purchases[0].orderId, 'GPA.1');
  assert.strictEqual(page.purchases[0].voidedTimeMillis, '1700000000000');
  assert.strictEqual(page.nextPageToken, 'page-2');
}

function testMissingTokenFailsThePage() {
  assert.throws(
    () => readVoidedPage({ voidedPurchases: [{ orderId: 'GPA.2' }] }),
    (err) => err && err.code === 'PLAY_VERIFY_FAILED'
  );
}

function testBrokenPageFails() {
  assert.throws(
    () => readVoidedPage({ voidedPurchases: 'nope' }),
    (err) => err && err.code === 'PLAY_VERIFY_FAILED'
  );
  assert.throws(
    () => readVoidedPage(null),
    (err) => err && err.code === 'PLAY_VERIFY_FAILED'
  );
}

testEmptyPage();
testOnePurchase();
testMissingTokenFailsThePage();
testBrokenPageFails();
console.log('voided purchase page ok');
