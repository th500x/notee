/**
 * City Events rules (notee-go docs/01-26-6). Date text → day keys, which raw items are
 * stored, the 12-month window, and one row per event when two publishers list it.
 */

const { httpError } = require('./httpError');

/** Table page shows Bangkok, scan page Pattaya. Same ids as News Notes. */
const CITY_EVENT_REGION_IDS = ['bkk', 'pty'];
const TITLE_MAX = 160;
/** Venue text the app hands to Google Maps as a search query. */
const PLACE_MAX = 160;
/** This month plus the next 11, to the last day of the 12th. */
const WINDOW_MONTHS = 12;
/** A mall listing longer than this is a standing promo or exhibition hall, not a date. */
const VENUE_DAYS_MAX = 62;
const SPAN_DAYS_MAX = 400;
const MANUAL_PUBLISHER = 'manual';
const TAT_PUBLISHER = 'tat';

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
/** `2–4 October 2026` · `30 September – 4 October 2026` · `09 Oct 26 - 19 Oct 26` · `7 Oct 2026`. */
const RANGE_RE =
  /^(\d{1,2})(?:\s+([a-z]{3,9})\.?)?(?:\s+(\d{4}|\d{2}))?(?:\s*-\s*(\d{1,2})(?:\s+([a-z]{3,9})\.?)?(?:\s+(\d{4}|\d{2}))?)?(?!\w)/i;
const DASH_RE = /[\u2012-\u2015\u2212]/g;
const THAI_RE = /[\u0E00-\u0E7F]/;

/** Names only: the event can stay once the sponsor is gone (docs/07 §8.3a). */
const ALCOHOL_BRANDS = [
  'Singha', 'Leo Beer', 'Chang Beer', 'Chang Classic', 'Chang Music Connection',
  'Heineken', 'Carlsberg', 'Asahi', 'Hoegaarden', 'Tiger Beer', 'Budweiser', 'Corona Extra',
  'SangSom', 'Hong Thong', 'Johnnie Walker', 'Jameson', 'Hennessy', 'Absolut', 'Smirnoff',
  'Bacardi', "Jack Daniel's", 'Chivas', 'Jagermeister', 'J\u00e4germeister',
];
const BRAND_RE = new RegExp(
  `\\b(?:${ALCOHOL_BRANDS.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);
/** What is left after the brand is still a drinks promo. */
const ALCOHOL_RE =
  /\b(?:beers?|wines?|whisk(?:e)?y|cocktails?|liquor|brewer(?:y|ies)|oktoberfest|happy hour|pub crawl|bar crawl)\b/i;
/** Mall pages also list sales, weekend promos and weekly classes. */
const VENUE_SKIP_RE =
  /%|\b(?:sales?|discounts?|deals?|privileges?|cash ?back|coupons?|vouchers?|promotions?|promo|members?|membership|weekend special|yoga|pilates|aerobics?|zumba|fitness|workouts?|class(?:es)?|workshops?|donation)\b/i;
/** Left where a brand came out: `Chang Music Connection presents FATCAT Marathon`. */
const CONNECTOR_RE =
  /^(?:presents?:?|x|\u00d7|by|feat\.?|with|&|[-:|,])\s+|\s+(?:presents?|x|\u00d7|by|feat\.?|with|&|[-:|,])$/i;

function utcDay(dayKey) {
  const m = DAY_KEY_RE.exec(String(dayKey));
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(ms).toISOString().slice(0, 10) === dayKey ? ms : null;
}

function isDayKey(raw) {
  return typeof raw === 'string' && utcDay(raw) !== null;
}

function dayKeyOf(year, month, day) {
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isDayKey(key) ? key : null;
}

function monthNumber(token) {
  if (!token) return 0;
  const lower = token.toLowerCase();
  return MONTH_NAMES.findIndex((name) => name.startsWith(lower)) + 1;
}

function fullYear(token) {
  if (!token) return 0;
  const n = Number(token);
  return token.length === 2 ? 2000 + n : n;
}

/**
 * Day range at the start of a line, or null. The later year carries to the earlier
 * date; a start month after the end month means the start is in the year before.
 * Anything after the range (`| 17:00–00:00 hrs`) is ignored.
 * @returns {{ startDayKey: string, endDayKey: string } | null}
 */
function parseDayRange(text) {
  const normalized = String(text || '')
    .replace(DASH_RE, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^date\s*:\s*/i, '');
  const m = RANGE_RE.exec(normalized);
  if (!m) return null;
  const [, d1, m1Raw, y1Raw, d2, m2Raw, y2Raw] = m;
  let m1 = monthNumber(m1Raw);
  let m2 = monthNumber(m2Raw);
  if ((m1Raw && !m1) || (m2Raw && !m2)) return null;
  if (!d2) {
    const day = m1 && y1Raw ? dayKeyOf(fullYear(y1Raw), m1, d1) : null;
    return day ? { startDayKey: day, endDayKey: day } : null;
  }
  m1 = m1 || m2;
  m2 = m2 || m1;
  const y2 = fullYear(y2Raw) || fullYear(y1Raw);
  if (!m1 || !y2) return null;
  const y1 = fullYear(y1Raw) || (m1 > m2 ? y2 - 1 : y2);
  const startDayKey = dayKeyOf(y1, m1, d1);
  const endDayKey = dayKeyOf(y2, m2, d2);
  if (!startDayKey || !endDayKey || startDayKey > endDayKey) return null;
  return { startDayKey, endDayKey };
}

function daySpan(startDayKey, endDayKey) {
  return (utcDay(endDayKey) - utcDay(startDayKey)) / DAY_MS + 1;
}

/** Last day of the window that opens in `todayKey`'s month. */
function windowEndDayKey(todayKey) {
  const [y, m] = todayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + WINDOW_MONTHS, 0)).toISOString().slice(0, 10);
}

/** English display name with alcohol brands taken out, or '' when it cannot be shown. */
function cleanTitle(raw) {
  let title = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!title || THAI_RE.test(title)) return '';
  const unbranded = title.replace(BRAND_RE, ' ').replace(/\s+/g, ' ').trim();
  if (unbranded !== title) {
    title = unbranded;
    for (let prev = ''; prev !== title; ) {
      prev = title;
      title = title.replace(CONNECTOR_RE, '').trim();
    }
  }
  return title && Array.from(title).length <= TITLE_MAX ? title : '';
}

/** Map search text, or '' when there is none or it is too long to be one place. */
function cleanPlace(raw) {
  const place = String(raw || '').replace(/\s+/g, ' ').trim();
  return Array.from(place).length <= PLACE_MAX ? place : '';
}

/** Case, punctuation, a leading "The" and the year do not make another event. */
function titleKey(title) {
  return String(title)
    .toLowerCase()
    .replace(/\b20\d\d\b/g, ' ')
    .replace(/^\s*the\s+/, '')
    .replace(/[^a-z0-9]+/g, '');
}

function eventKey(regionId, title, startDayKey) {
  return `${regionId}|${titleKey(title)}|${startDayKey}`;
}

/**
 * One raw item as stored, or null. `venue` publishers (malls) also drop sales,
 * classes and month-long listings. Ended events are not stored. `place` is '' when unknown.
 * @param {{ regionId: string, title: string, startDayKey: string, endDayKey: string, place?: string }} raw
 * @param {{ venue: boolean, todayKey: string }} options
 */
function acceptEvent(raw, { venue, todayKey }) {
  if (!CITY_EVENT_REGION_IDS.includes(raw.regionId)) return null;
  if (!isDayKey(raw.startDayKey) || !isDayKey(raw.endDayKey)) return null;
  if (raw.startDayKey > raw.endDayKey || raw.endDayKey < todayKey) return null;
  const span = daySpan(raw.startDayKey, raw.endDayKey);
  if (span > (venue ? VENUE_DAYS_MAX : SPAN_DAYS_MAX)) return null;
  const title = cleanTitle(raw.title);
  if (!title || ALCOHOL_RE.test(title)) return null;
  if (venue && VENUE_SKIP_RE.test(title)) return null;
  return {
    regionId: raw.regionId,
    title,
    startDayKey: raw.startDayKey,
    endDayKey: raw.endDayKey,
    place: cleanPlace(raw.place),
  };
}

/** Hand-entered wording first, then the venue's own page, then TAT's calendar. */
function publisherRank(publisher) {
  if (publisher === MANUAL_PUBLISHER) return 0;
  return publisher === TAT_PUBLISHER ? 2 : 1;
}

function sameEvent(a, b) {
  if (a.regionId !== b.regionId) return false;
  if (a.startDayKey > b.endDayKey || b.startDayKey > a.endDayKey) return false;
  const [short, long] = [titleKey(a.title), titleKey(b.title)].sort((x, y) => x.length - y.length);
  return short.length >= 6 && long.includes(short);
}

/**
 * One row per event across publishers: same city, overlapping days, and one name
 * inside the other ("Bangkok Watch Week" ⊂ "Siam Paragon Bangkok Watch Week").
 * Result is ordered by start day, end day, then title.
 */
function pickDistinct(events) {
  const ranked = [...events].sort((a, b) => publisherRank(a.publisher) - publisherRank(b.publisher));
  const kept = [];
  for (const event of ranked) {
    if (!kept.some((other) => sameEvent(event, other))) kept.push(event);
  }
  return kept.sort(
    (a, b) =>
      a.startDayKey.localeCompare(b.startDayKey) ||
      a.endDayKey.localeCompare(b.endDayKey) ||
      a.title.localeCompare(b.title)
  );
}

function assertRegionId(raw) {
  if (typeof raw !== 'string' || !CITY_EVENT_REGION_IDS.includes(raw)) {
    throw httpError(400, 'region 须为 bkk 或 pty', 'CITY_EVENT_BAD_REGION');
  }
  return raw;
}

module.exports = {
  CITY_EVENT_REGION_IDS,
  TITLE_MAX,
  VENUE_DAYS_MAX,
  MANUAL_PUBLISHER,
  TAT_PUBLISHER,
  isDayKey,
  parseDayRange,
  windowEndDayKey,
  cleanTitle,
  cleanPlace,
  titleKey,
  eventKey,
  acceptEvent,
  pickDistinct,
  assertRegionId,
};
