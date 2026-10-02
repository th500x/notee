/**
 * City Events (notee-go docs/01-26-6): a daily read of official pages into
 * `city_events`, hand-entered rows, and the 12-month list behind the Bar hub's sixth tile.
 */

const { query, transaction } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const { dayKeyFromDate } = require('../lib/dayKey');
const { fetchText } = require('../lib/fetchText');
const { CITY_EVENT_PUBLISHERS } = require('../lib/cityEventPublishers');
const {
  MANUAL_PUBLISHER,
  isDayKey,
  windowEndDayKey,
  cleanPlace,
  eventKey,
  acceptEvent,
  pickDistinct,
  assertRegionId,
} = require('../lib/cityEventRules');

const USER_AGENT = 'Mozilla/5.0 (compatible; NoteeGoEvents/1.0; +https://notee.vip)';
const ACCEPT = 'text/html, application/json;q=0.9, */*;q=0.1';

function getText(url) {
  return fetchText(url, { userAgent: USER_AGENT, accept: ACCEPT });
}

/** API shape; `place` only when known, so the app shows no map button for it. */
function rowToEvent(row) {
  const event = {
    regionId: row.region_id,
    title: row.title,
    startDayKey: row.start_day_key,
    endDayKey: row.end_day_key,
  };
  return row.place ? { ...event, place: row.place } : event;
}

/** Raw items of one page as stored: accepted, city and venue filled in, one per event key. */
function acceptItems(publisher, rawItems, todayKey) {
  const items = new Map();
  for (const raw of rawItems) {
    const item = acceptEvent(
      { ...raw, regionId: raw.regionId || publisher.regionId, place: raw.place || publisher.place },
      { venue: publisher.venue, todayKey }
    );
    if (item) items.set(eventKey(item.regionId, item.title, item.startDayKey), item);
  }
  return items;
}

/**
 * A page's rows become exactly `items`. Rows that stay keep their id and `hidden_at`.
 * A second row with the same key (two runs overlapping) is dropped.
 */
async function replacePage(publisherId, url, items) {
  return transaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, region_id, title, start_day_key FROM city_events WHERE publisher = ? AND url = ? ORDER BY id`,
      [publisherId, url]
    );
    const existing = new Map();
    const stale = [];
    for (const row of rows) {
      const key = eventKey(row.region_id, row.title, row.start_day_key);
      if (existing.has(key)) stale.push(row.id);
      else existing.set(key, row.id);
    }
    let added = 0;
    for (const [key, item] of items) {
      const id = existing.get(key);
      if (id !== undefined) {
        existing.delete(key);
        await conn.query(`UPDATE city_events SET title = ?, end_day_key = ?, place = ? WHERE id = ?`, [
          item.title,
          item.endDayKey,
          item.place,
          id,
        ]);
      } else {
        await conn.query(
          `INSERT INTO city_events (region_id, title, start_day_key, end_day_key, place, publisher, url)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [item.regionId, item.title, item.startDayKey, item.endDayKey, item.place, publisherId, url]
        );
        added += 1;
      }
    }
    stale.push(...existing.values());
    if (stale.length > 0) {
      await conn.query(`DELETE FROM city_events WHERE id IN (?)`, [stale]);
    }
    return { added, removed: stale.length };
  });
}

/** Page text, or null when the publisher says the page is gone (404 / 410). */
async function pageText(page) {
  if (page.gone) return null;
  if (page.text !== undefined) return page.text;
  try {
    return await getText(page.url);
  } catch (err) {
    if (err.status === 404 || err.status === 410) return null;
    throw err;
  }
}

/**
 * A page that fails to load keeps its rows; the next run tries again. So does a page
 * that loads but reads as nothing: a layout change must not empty the tile, and those
 * rows still go once they end. Only a gone page, or one whose items all fail the rules,
 * drops them.
 */
async function collectPublisher(publisher, todayKey) {
  const known = await query(
    `SELECT DISTINCT url FROM city_events WHERE publisher = ? AND url <> ''`,
    [publisher.id]
  );
  const pages = await publisher.pages(getText, known.map((row) => row.url), todayKey);
  const tally = { pages: pages.length, found: 0, kept: 0, added: 0, removed: 0, unread: 0, failed: [] };
  for (const page of pages) {
    let text;
    try {
      text = await pageText(page);
    } catch (err) {
      tally.failed.push(`${page.url} ${err.message}`);
      continue;
    }
    const raw = text === null ? [] : publisher.read(text);
    if (text !== null && raw.length === 0) {
      tally.unread += 1;
      continue;
    }
    const items = acceptItems(publisher, raw, todayKey);
    const result = await replacePage(publisher.id, page.url, items);
    tally.found += raw.length;
    tally.kept += items.size;
    tally.added += result.added;
    tally.removed += result.removed;
  }
  return tally;
}

/**
 * One collection run: purge ended rows, then read every publisher. A publisher that
 * throws is reported and the rest still run.
 * @returns {{ purged: number, publishers: object[] }}
 */
async function collectCityEvents(now = new Date()) {
  const todayKey = dayKeyFromDate(now);
  const purged = await query(`DELETE FROM city_events WHERE end_day_key < ?`, [todayKey]);
  const publishers = [];
  for (const publisher of CITY_EVENT_PUBLISHERS) {
    try {
      publishers.push({ id: publisher.id, ...(await collectPublisher(publisher, todayKey)) });
    } catch (err) {
      publishers.push({ id: publisher.id, error: err.message });
    }
  }
  return { purged: purged.affectedRows, publishers };
}

/** Both cities, not ended, starting inside the 12-month window; one row per event. */
async function listCityEvents(now = new Date()) {
  const todayKey = dayKeyFromDate(now);
  const rows = await query(
    `SELECT region_id, title, start_day_key, end_day_key, place, publisher
     FROM city_events
     WHERE hidden_at IS NULL AND end_day_key >= ? AND start_day_key <= ?`,
    [todayKey, windowEndDayKey(todayKey)]
  );
  const items = pickDistinct(rows.map((row) => ({ ...rowToEvent(row), publisher: row.publisher })));
  return { items: items.map(({ publisher, ...item }) => item) };
}

/**
 * Hand-entered event. Same rules as a mall-free publisher: no alcohol, English, not ended.
 * The venue is required so the row always has a map button.
 */
async function addCityEvent({ regionId, title, startDayKey, endDayKey, place }, now = new Date()) {
  assertRegionId(regionId);
  if (!isDayKey(startDayKey) || !isDayKey(endDayKey)) {
    throw httpError(400, 'start / end 须为 YYYY-MM-DD', 'CITY_EVENT_BAD_DAY');
  }
  if (!cleanPlace(place)) {
    throw httpError(400, 'place 须为 1–160 字的地点', 'CITY_EVENT_BAD_PLACE');
  }
  const item = acceptEvent(
    { regionId, title, startDayKey, endDayKey, place },
    { venue: false, todayKey: dayKeyFromDate(now) }
  );
  if (!item) throw httpError(400, '名称或日期不合收录规则', 'CITY_EVENT_REJECTED');
  const result = await query(
    `INSERT INTO city_events (region_id, title, start_day_key, end_day_key, place, publisher)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [item.regionId, item.title, item.startDayKey, item.endDayKey, item.place, MANUAL_PUBLISHER]
  );
  return { id: result.insertId, ...item };
}

/** Moderator hide / unhide. A collected row stays hidden while its page keeps listing it. */
async function setCityEventHidden(id, hidden) {
  const result = await query(
    `UPDATE city_events SET hidden_at = ${hidden ? 'UTC_TIMESTAMP()' : 'NULL'} WHERE id = ?`,
    [id]
  );
  if (result.affectedRows === 0) throw httpError(404, '没有这条活动', 'CITY_EVENT_NOT_FOUND');
}

/** Only hand-entered rows; a collected row would come back on the next run. */
async function deleteManualCityEvent(id) {
  const result = await query(`DELETE FROM city_events WHERE id = ? AND publisher = ?`, [
    id,
    MANUAL_PUBLISHER,
  ]);
  if (result.affectedRows === 0) throw httpError(404, '没有这条手工活动', 'CITY_EVENT_NOT_FOUND');
}

/** Every stored row for the moderator script, hidden ones included. */
async function listStoredCityEvents() {
  const rows = await query(
    `SELECT id, region_id, title, start_day_key, end_day_key, place, publisher, url, hidden_at IS NOT NULL AS hidden
     FROM city_events
     ORDER BY region_id, start_day_key, title`
  );
  return rows.map((row) => ({
    id: row.id,
    ...rowToEvent(row),
    publisher: row.publisher,
    url: row.url,
    hidden: Boolean(row.hidden),
  }));
}

module.exports = {
  collectCityEvents,
  listCityEvents,
  addCityEvent,
  setCityEventHidden,
  deleteManualCityEvent,
  listStoredCityEvents,
};
