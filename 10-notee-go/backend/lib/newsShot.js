/**
 * Frozen monthly-board page shots (notee-go docs/06 §4).
 * JPEG files live on disk. The database keeps the headline row and never the picture.
 *
 *   backend/data/news-board/{YYYY-MM}/{regionId}/{rank}.jpg
 *
 * The public path is /api/notee-go/news/shot/{YYYY-MM}/{regionId}/{rank}.jpg
 */

const fs = require('fs');
const path = require('path');
const { NEWS_REGION_IDS } = require('./newsFeeds');

const SHOT_ROOT = path.join(__dirname, '..', 'data', 'news-board');
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const GOTO_TIMEOUT_MS = 20_000;
const VIEWPORT = { width: 1280, height: 1600, deviceScaleFactor: 1 };

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

async function shootPage(browser, url, dest) {
  const page = await browser.newPage();
  try {
    await page.setViewport(VIEWPORT);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: GOTO_TIMEOUT_MS });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const buf = await page.screenshot({ type: 'jpeg', quality: 60 });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.tmp`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, dest);
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * One JPEG per frozen row that does not already have a file.
 * A failed page is skipped; the headline link stays the fallback.
 * @param {{ monthKey: string, regionId: string, rank: number, url: string }[]} rows
 * @returns {Promise<{ saved: number, skipped: number, failed: string[] }>}
 */
async function captureRows(rows) {
  const pending = [];
  let skipped = 0;
  for (const row of rows) {
    if (!isShotKey(row.monthKey, row.regionId, row.rank) || !row.url) continue;
    if (shotExists(row.monthKey, row.regionId, row.rank)) {
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
      const dest = shotFile(row.monthKey, row.regionId, row.rank);
      try {
        await shootPage(browser, row.url, dest);
        saved += 1;
      } catch (err) {
        failed.push(`${row.monthKey}/${row.regionId}/${row.rank} ${err.message}`);
        fs.rmSync(`${dest}.tmp`, { force: true });
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
