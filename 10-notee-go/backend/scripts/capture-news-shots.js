/**
 * Text cards for an already-frozen month: `npm run jobs:news-shots -- [YYYY-MM] [--force]`
 * Defaults to 2026-09. Rows that already have a card are skipped; --force redraws them.
 */

const { pool } = require('../database/connection');
const { captureRows } = require('../lib/newsShot');
const { frozenCardRows } = require('../services/newsService');

const args = process.argv.slice(2);
const force = args.includes('--force');
const monthKey = args.find((a) => !a.startsWith('--')) || '2026-09';

async function main() {
  const rows = await frozenCardRows(monthKey);
  if (rows.length === 0) {
    console.log(`[notee-go/news-shot] ${monthKey} has no frozen rows`);
    return;
  }
  console.log(`[notee-go/news-shot] ${monthKey} rows=${rows.length}${force ? ' force' : ''}`);
  const result = await captureRows(rows, {
    force,
    log: (line) => console.log(`[notee-go/news-shot] ${line}`),
  });
  console.log(
    `[notee-go/news-shot] saved=${result.saved} skipped=${result.skipped} failed=${result.failed.length}`
  );
  for (const line of result.failed) console.warn(`[notee-go/news-shot] ${line}`);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
