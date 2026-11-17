/**
 * Staff-only Party Pass assignment. Not an HTTP route.
 * Usage: node scripts/grant-party-pass.js <loginId> <99|499|ultra|none>
 */

const { grantStaff } = require('../services/partyPassService');
const { pool } = require('../database/connection');

async function main() {
  const loginId = process.argv[2];
  const tier = process.argv[3];
  if (!loginId || !tier) {
    console.error('Usage: node scripts/grant-party-pass.js <loginId> <99|499|ultra|none>');
    process.exit(1);
  }
  try {
    const user = await grantStaff(loginId, tier);
    console.log(JSON.stringify({
      ok: true,
      loginId: user.loginId,
      partyTier: user.partyTier,
      partyMarksTotal: user.partyMarksTotal,
    }, null, 2));
  } catch (err) {
    console.error(err.code || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
