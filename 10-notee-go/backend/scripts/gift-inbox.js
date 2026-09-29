/**
 * Show pending gifts for a short id. Not a public API.
 * Usage: node scripts/gift-inbox.js <loginId>
 */

const { inboxForLoginId } = require('../services/giftService');
const { pool } = require('../database/connection');

async function main() {
  const loginId = process.argv[2];
  if (!loginId) {
    console.error('Usage: node scripts/gift-inbox.js <loginId>');
    process.exit(1);
  }
  try {
    const campaigns = await inboxForLoginId(loginId);
    console.log(JSON.stringify({ ok: true, loginId: loginId.toUpperCase(), campaigns }, null, 2));
  } catch (err) {
    console.error(err.code || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
