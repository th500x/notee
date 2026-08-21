/**
 * Create a gift campaign. Not a public API.
 * Usage:
 *   node scripts/gift-create.js --audience all --kind stamp --id th_lopburi [--require-login] [--title "New Year Gift"]
 *   # Region 泰国 12 城
 *   node scripts/gift-create.js --audience login_ids --ids TTGO --kind stamp --series region --country th --title "Thailand Region"
 *   # Limited 泰国（现 1 枚：th_lopburi）
 *   node scripts/gift-create.js --audience login_ids --ids TTGO --kind stamp --series limited --country th --title "Lopburi Limited"
 */

const { createCampaign } = require('../services/giftService');
const { resolveGiftStampIds } = require('../lib/giftRules');
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
  if (!args.audience || !args.kind) {
    console.error(
      'Usage: node scripts/gift-create.js --audience all|login_ids --kind stamp (--id <stampId> | --series region|limited --country th) [--ids TTGO,CD34] [--require-login] [--title "New Year Gift"]'
    );
    process.exit(1);
  }
  try {
    const stampIds = resolveGiftStampIds({
      itemId: args.id,
      series: args.series,
      country: args.country,
    });
    const note = typeof args.title === 'string' ? args.title : typeof args.note === 'string' ? args.note : null;
    const campaigns = [];
    for (const stampId of stampIds) {
      const created = await createCampaign({
        audience: args.audience,
        kind: args.kind,
        itemId: stampId,
        loginIds: args.ids,
        requireLoginId: Boolean(args.requireLogin),
        note,
      });
      campaigns.push(created);
    }
    console.log(JSON.stringify({ ok: true, count: campaigns.length, campaigns }, null, 2));
  } catch (err) {
    console.error(err.code || err.message);
    if (err.missing) console.error(err.missing.join(','));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
