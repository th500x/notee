/**
 * Frozen monthly-board text cards (notee-go docs/06 §4). Layout: lib/newsCard.js.
 * JPEG files live on disk. The database keeps the headline row and never the picture.
 *
 *   backend/data/news-board/{YYYY-MM}/{regionId}/{rank}.jpg
 *
 * The public path is /api/notee-go/news/shot/{YYYY-MM}/{regionId}/{rank}.jpg
 */

const fs = require('fs');
const path = require('path');
const { NEWS_REGION_IDS } = require('./newsFeeds');
const { buildCard, readArticle, renderCard } = require('./newsCard');

const SHOT_ROOT = path.join(__dirname, '..', 'data', 'news-board');
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function shotFile(monthKey, regionId, rank) {
  return path.join(SHOT_ROOT, monthKey, regionId, `${rank}.jpg`);
}

/** Path under the API root (`/api/notee-go` + this). Null when the file is not there. */
function shotRelPath(monthKey, regionId, rank) {
  if (!shotExists(monthKey, regionId, rank)) return null;
  return `/news/shot/${monthKey}/${regionId}/${rank}.jpg`;
}

function shotExists(monthKey, regionId, rank) {
  if (!isShotKey(monthKey, regionId, rank)) return false;
  return fs.existsSync(shotFile(monthKey, regionId, rank));
}

function isShotKey(monthKey, regionId, rank) {
  const n = Number(rank);
  return MONTH_RE.test(monthKey) &&
    NEWS_REGION_IDS.includes(regionId) &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= 10;
}

/**
 * Read a shot only when the resolved path stays inside SHOT_ROOT.
 * @returns {string|null} absolute file path
 */
function resolveShotFile(monthKey, regionId, rank) {
  if (!isShotKey(monthKey, regionId, rank)) return null;
  const file = path.resolve(shotFile(monthKey, regionId, rank));
  const root = path.resolve(SHOT_ROOT);
  if (!file.startsWith(root + path.sep)) return null;
  return fs.existsSync(file) ? file : null;
}

async function launchBrowser() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (err) {
    throw new Error('puppeteer is not installed (npm install in backend/)');
  }
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

async function cardForRow(browser, row, dest) {
  let card;
  try {
    card = buildCard(await readArticle(browser, row.url), row);
  } catch (_) {
    card = buildCard(await readArticle(browser, row.url), row);
  }
  const { buf, fontPx, trimmed } = await renderCard(browser, card);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, dest);
  return { fontPx, trimmed };
}

/**
 * One card per frozen row. Rows that already have a file are skipped unless [force].
 * A failed article is skipped and the headline link stays the fallback; with [force]
 * its old file is removed so no stale picture stays behind.
 * @param {{ monthKey: string, regionId: string, rank: number, url: string,
 *   title: string, publisher: string, publishedAt: string }[]} rows
 * @param {{ force?: boolean, log?: (line: string) => void }} [options]
 * @returns {Promise<{ saved: number, skipped: number, failed: string[] }>}
 */
async function captureRows(rows, { force = false, log } = {}) {
  const pending = [];
  let skipped = 0;
  for (const row of rows) {
    if (!isShotKey(row.monthKey, row.regionId, row.rank) || !row.url) continue;
    if (!force && shotExists(row.monthKey, row.regionId, row.rank)) {
      skipped += 1;
      continue;
    }
    pending.push(row);
  }
  if (pending.length === 0) return { saved: 0, skipped, failed: [] };

  const browser = await launchBrowser();
  let saved = 0;
  const failed = [];
  try {
    for (const row of pending) {
      const key = `${row.monthKey}/${row.regionId}/${row.rank}`;
      const dest = shotFile(row.monthKey, row.regionId, row.rank);
      try {
        const { fontPx, trimmed } = await cardForRow(browser, row, dest);
        saved += 1;
        if (log) log(`${key} font=${fontPx}px${trimmed ? ' trimmed' : ''}`);
      } catch (err) {
        failed.push(`${key} ${err.message}`);
        fs.rmSync(`${dest}.tmp`, { force: true });
        if (force) fs.rmSync(dest, { force: true });
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return { saved, skipped, failed };
}

module.exports = {
  SHOT_ROOT,
  shotRelPath,
  shotExists,
  isShotKey,
  resolveShotFile,
  captureRows,
};
