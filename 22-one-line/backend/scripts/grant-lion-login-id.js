/**
 * Grant a lion login id (0000–9999 / AAAA–ZZZZ) to an already-registered account.
 * Usage: node scripts/grant-lion-login-id.js <userId> <loginId>
 *
 * Not a public API. Old short id is released; the lion stays out of auto-pick.
 */

const { grantLionLoginId } = require('../services/userService');
const { pool } = require('../database/connection');

async function main() {
  const userId = process.argv[2];
  const loginId = process.argv[3];
  if (!userId || !loginId) {
    console.error('Usage: node scripts/grant-lion-login-id.js <userId> <loginId>');
    process.exit(1);
  }
  try {
    const user = await grantLionLoginId(userId, loginId);
    console.log(JSON.stringify({ ok: true, userId: user.id, loginId: user.loginId }, null, 2));
  } catch (err) {
    console.error(err.code || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
