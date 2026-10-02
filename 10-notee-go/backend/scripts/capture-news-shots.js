/**
 * Capture page shots for an already-frozen month.
 * September 2026 was frozen before shots existed: `npm run jobs:news-shots`
 * Defaults to 2026-09. Pass another YYYY-MM as the first argument.
 */

const { pool, query } = require('../database/connection');
const { captureRows } = require('../lib/newsShot');

const monthKey = process.argv[2] || '2026-09';

async function main() {
  const rows = await query(
    `SELECT month_key, region_id, rank_no, url, title
     FROM news_monthly_board
     WHERE month_key = ?
     ORDER BY region_id, rank_no`,
    [monthKey]
  );
  if (rows.length === 0) {
    console.log(`[notee-go/news-shot] ${monthKey} has no frozen rows`);
    return;
  }
  console.log(`[notee-go/news-shot] ${monthKey} rows=${rows.length}`);
  const result = await captureRows(rows.map((row) => ({
    monthKey: row.month_key,
    regionId: row.region_id,
    rank: Number(row.rank_no),
    url: row.url,
  })));
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
