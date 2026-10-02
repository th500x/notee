/**
 * News Notes (notee-go docs/06): RSS collection every 2h, the 24h list per region,
 * and the monthly Top 10 (live for the current UTC+7 month, frozen once closed).
 */

const { query, transaction } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const {
  assertMonthKey,
  monthKeyFromDate,
  previousMonthKey,
  toMysqlDateTimeUtc,
  sqlIsoUtc,
} = require('../lib/dayKey');
const { NEWS_FEEDS } = require('../lib/newsFeeds');
const { parseRssItems } = require('../lib/newsRss');
const {
  LATEST_SIZE,
  BOARD_SIZE,
  WINDOW_MS,
  assertRegionId,
  slotStart,
  freshItems,
} = require('../lib/newsRules');
const { shotRelPath, captureRows } = require('../lib/newsShot');

const FETCH_TIMEOUT_MS = 15 * 1000;
const USER_AGENT = 'Mozilla/5.0 (compatible; NoteeGoNews/1.0; +https://notee.vip)';

/** Live board and freeze share one order, so a frozen month matches its last live view. */
const RANK_ORDER = 'hit_count DESC, published_at ASC, url ASC';

const PUBLISHED_AT_ISO = sqlIsoUtc('published_at');

/** Hits only once per 2h slot: a restart or a second run inside the slot re-reads the feed. */
const UPSERT_ITEM_SQL = `INSERT INTO news_items
    (region_id, url, title, publisher, published_at, month_key, hit_count, last_seen_at)
  VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  ON DUPLICATE KEY UPDATE
    hit_count = hit_count + IF(last_seen_at < ?, 1, 0),
    title = ?,
    last_seen_at = ?`;

function rowToItem(row) {
  return {
    title: row.title,
    publisher: row.publisher,
    url: row.url,
    publishedAt: row.published_at_iso,
  };
}

function rowToBoardItem(row, rank, monthKey, regionId, frozen) {
  const item = { rank, ...rowToItem(row) };
  if (!frozen) return item;
  const shotUrl = shotRelPath(monthKey, regionId, rank);
  return shotUrl ? { ...item, shotUrl } : item;
}

async function fetchFeedXml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.1',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function isMonthFrozen(monthKey) {
  const rows = await query(
    `SELECT month_key FROM news_monthly_board_meta WHERE month_key = ? LIMIT 1`,
    [monthKey]
  );
  return rows.length > 0;
}

/** Idempotent: copies each region's Top 10 for a closed month, then marks the month. */
async function freezeMonth(monthKey) {
  return transaction(async (conn) => {
    const [metaRows] = await conn.query(
      `SELECT month_key FROM news_monthly_board_meta WHERE month_key = ? LIMIT 1`,
      [monthKey]
    );
    if (metaRows[0]) return false;

    const [result] = await conn.query(
      `INSERT INTO news_monthly_board
         (month_key, region_id, rank_no, url, title, publisher, published_at, hit_count)
       SELECT month_key, region_id, rank_no, url, title, publisher, published_at, hit_count
       FROM (
         SELECT month_key, region_id, url, title, publisher, published_at, hit_count,
                ROW_NUMBER() OVER (PARTITION BY region_id ORDER BY ${RANK_ORDER}) AS rank_no
         FROM news_items
         WHERE month_key = ?
       ) ranked
       WHERE rank_no <= ?`,
      [monthKey, BOARD_SIZE]
    );
    await conn.query(
      `INSERT INTO news_monthly_board_meta (month_key, item_count) VALUES (?, ?)`,
      [monthKey, result.affectedRows]
    );
    return true;
  });
}

/** The previous month always gets a record (even empty); older stragglers too. */
async function freezeClosedMonths(now) {
  const rows = await query(`SELECT DISTINCT month_key FROM news_items WHERE month_key < ?`, [
    monthKeyFromDate(now),
  ]);
  const months = new Set(rows.map((row) => row.month_key));
  months.add(previousMonthKey(now));
  const frozen = [];
  for (const monthKey of [...months].sort()) {
    if (await freezeMonth(monthKey)) frozen.push(monthKey);
  }
  return frozen;
}

/** A frozen month's rows live on in news_monthly_board once they leave the 24h list. */
async function purgeFrozenItems(now) {
  const result = await query(
    `DELETE i FROM news_items i
     INNER JOIN news_monthly_board_meta m ON m.month_key = i.month_key
     WHERE i.published_at < ?`,
    [toMysqlDateTimeUtc(new Date(now.getTime() - WINDOW_MS))]
  );
  return result.affectedRows;
}

/**
 * One collection run: read every feed, upsert fresh headlines, freeze closed months, purge.
 * A failed feed is reported and skipped; the others still count.
 * @returns {{ stored: number, failed: string[], frozen: string[], purged: number }}
 */
async function collectNews(now = new Date()) {
  const seenSql = toMysqlDateTimeUtc(now);
  const slotSql = toMysqlDateTimeUtc(slotStart(now));
  const results = await Promise.allSettled(NEWS_FEEDS.map((feed) => fetchFeedXml(feed.url)));

  let stored = 0;
  const failed = [];
  for (const [i, feed] of NEWS_FEEDS.entries()) {
    const result = results[i];
    if (result.status === 'rejected') {
      failed.push(`${feed.url} (${result.reason.message})`);
      continue;
    }
    const parsed = parseRssItems(result.value);
    if (parsed.length === 0) {
      failed.push(`${feed.url} (no items)`);
      continue;
    }
    for (const item of freshItems(parsed, now)) {
      await query(UPSERT_ITEM_SQL, [
        feed.regionId,
        item.url,
        item.title,
        feed.publisher,
        toMysqlDateTimeUtc(item.publishedAt),
        monthKeyFromDate(item.publishedAt),
        seenSql,
        slotSql,
        item.title,
        seenSql,
      ]);
      stored += 1;
    }
  }

  const frozen = await freezeClosedMonths(now);
  const purged = await purgeFrozenItems(now);
  const shots = await captureFrozenMonths(frozen);
  return { stored, failed, frozen, purged, shots };
}

/** Page shots for months this run just froze. A browser failure does not undo the freeze. */
async function captureFrozenMonths(monthKeys) {
  const totals = { saved: 0, skipped: 0, failed: [] };
  for (const monthKey of monthKeys) {
    const rows = await query(
      `SELECT month_key, region_id, rank_no, url
       FROM news_monthly_board
       WHERE month_key = ?`,
      [monthKey]
    );
    try {
      const part = await captureRows(rows.map((row) => ({
        monthKey: row.month_key,
        regionId: row.region_id,
        rank: Number(row.rank_no),
        url: row.url,
      })));
      totals.saved += part.saved;
      totals.skipped += part.skipped;
      totals.failed.push(...part.failed);
    } catch (err) {
      totals.failed.push(`${monthKey} ${err.message}`);
    }
  }
  return totals;
}

/** Newest first, last 24h, capped per region. */
async function listLatest(regionRaw, now = new Date()) {
  const regionId = assertRegionId(regionRaw);
  const rows = await query(
    `SELECT url, title, publisher, ${PUBLISHED_AT_ISO}
     FROM news_items
     WHERE region_id = ? AND published_at >= ?
     ORDER BY published_at DESC, url ASC
     LIMIT ?`,
    [regionId, toMysqlDateTimeUtc(new Date(now.getTime() - WINDOW_MS)), LATEST_SIZE]
  );
  return { regionId, items: rows.map(rowToItem) };
}

/**
 * Current month (or a closed month not frozen yet): live ranks from news_items.
 * Frozen month: the record as written on the 1st.
 */
async function getNewsBoard(regionRaw, monthQuery, now = new Date()) {
  const regionId = assertRegionId(regionRaw);
  const current = monthKeyFromDate(now);
  const monthKey = monthQuery ? assertMonthKey(monthQuery) : current;
  if (monthKey > current) {
    throw httpError(400, '不能查询未来月份', 'BAD_MONTH');
  }

  if (monthKey < current && (await isMonthFrozen(monthKey))) {
    const rows = await query(
      `SELECT rank_no, url, title, publisher, ${PUBLISHED_AT_ISO}
       FROM news_monthly_board
       WHERE month_key = ? AND region_id = ?
       ORDER BY rank_no ASC`,
      [monthKey, regionId]
    );
    return {
      regionId,
      monthKey,
      source: 'frozen',
      items: rows.map((row) => rowToBoardItem(
        row,
        Number(row.rank_no),
        monthKey,
        regionId,
        true
      )),
    };
  }

  const rows = await query(
    `SELECT url, title, publisher, ${PUBLISHED_AT_ISO}
     FROM news_items
     WHERE month_key = ? AND region_id = ?
     ORDER BY ${RANK_ORDER}
     LIMIT ?`,
    [monthKey, regionId, BOARD_SIZE]
  );
  return {
    regionId,
    monthKey,
    source: 'live',
    items: rows.map((row, i) => rowToBoardItem(row, i + 1)),
  };
}

module.exports = {
  collectNews,
  listLatest,
  getNewsBoard,
  freezeMonth,
};
