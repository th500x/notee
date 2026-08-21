/**
 * Create a gift campaign. Not a public API.
 * Usage:
 *   node scripts/gift-create.js --audience all --kind stamp --id th_lopburi [--require-login]
 *   node scripts/gift-create.js --audience login_ids --ids AB12,CD34 --kind stamp --id th_bangkok
 */

const { createCampaign } = require('../services/giftService');
const { pool } = require('../database/connection');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--require-login') {
      out.requireLogin = true;
      continue;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i += 1;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.audience || !args.kind || !args.id) {
    console.error(
      'Usage: node scripts/gift-create.js --audience all|login_ids --kind stamp --id <stampId> [--ids AB12,CD34] [--require-login] [--note "..."]'
    );
    process.exit(1);
  }
  try {
    const created = await createCampaign({
      audience: args.audience,
      kind: args.kind,
      itemId: args.id,
      loginIds: args.ids,
      requireLoginId: Boolean(args.requireLogin),
      note: typeof args.note === 'string' ? args.note : null,
    });
    console.log(JSON.stringify({ ok: true, ...created }, null, 2));
  } catch (err) {
    console.error(err.code || err.message);
    if (err.missing) console.error(err.missing.join(','));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
