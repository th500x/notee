/**
 * Cancel a gift campaign. Not a public API.
 * Usage: node scripts/gift-cancel.js <campaignId>
 */

const { cancelCampaign } = require('../services/giftService');
const { pool } = require('../database/connection');

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node scripts/gift-cancel.js <campaignId>');
    process.exit(1);
  }
  try {
    const result = await cancelCampaign(id);
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } catch (err) {
    console.error(err.code || err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
