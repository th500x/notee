/**
 * News Notes rules (notee-go docs/06). Server half of Go `NewsRegion` / `NewsStore`.
 */

const { httpError } = require('./httpError');
const { TZ_OFFSET_MS } = require('./dayKey');
const { NEWS_REGION_IDS } = require('./newsFeeds');

const HOUR_MS = 60 * 60 * 1000;

/** 24h list cap per region (docs/06 §2: about 5–8). */
const LATEST_SIZE = 8;
/** Monthly board cap per region. */
const BOARD_SIZE = 10;
const WINDOW_MS = 24 * HOUR_MS;
/** Collection cadence. One hit per headline per slot, however often the job runs. */
const SLOT_MS = 2 * HOUR_MS;
const TITLE_MAX = 300;
const URL_MAX = 512;
/** Ads, columns and foreign desks are not local headlines. Matched against RSS <category>. */
const SKIP_CATEGORIES = new Set(['sponsored', 'opinion', 'international']);
const URL_RE = /^https?:\/\/\S+$/i;

function assertRegionId(raw) {
  if (typeof raw !== 'string' || !NEWS_REGION_IDS.includes(raw)) {
    throw httpError(400, 'region 无效', 'NEWS_BAD_REGION');
  }
  return raw;
}

/** Start of the UTC+7 two-hour slot holding `date` (00:00, 02:00 … Bangkok). */
function slotStart(date) {
  const shifted = date.getTime() + TZ_OFFSET_MS;
  return new Date(shifted - (shifted % SLOT_MS) - TZ_OFFSET_MS);
}

function isStorable(item) {
  if (!item.title || Array.from(item.title).length > TITLE_MAX) return false;
  if (!URL_RE.test(item.url) || item.url.length > URL_MAX) return false;
  if (!item.publishedAt) return false;
  return !item.categories.some((category) => SKIP_CATEGORIES.has(category.toLowerCase()));
}

/**
 * Feed rows to store: title, http(s) link and a publish time inside the last 24h.
 * Rows without a publish time are skipped. A future time is clamped to `now`.
 * @returns {{ title: string, url: string, publishedAt: Date }[]}
 */
function freshItems(parsed, now) {
  const nowMs = now.getTime();
  const since = nowMs - WINDOW_MS;
  const fresh = [];
  for (const item of parsed) {
    if (!isStorable(item)) continue;
    const publishedMs = Math.min(item.publishedAt.getTime(), nowMs);
    if (publishedMs < since) continue;
    fresh.push({ title: item.title, url: item.url, publishedAt: new Date(publishedMs) });
  }
  return fresh;
}

module.exports = {
  LATEST_SIZE,
  BOARD_SIZE,
  WINDOW_MS,
  SLOT_MS,
  TITLE_MAX,
  URL_MAX,
  assertRegionId,
  slotStart,
  freshItems,
};
