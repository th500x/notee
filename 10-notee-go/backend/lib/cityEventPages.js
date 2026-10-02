/**
 * Page readers for City Events (notee-go docs/01-26-6 §5). Pure: page text in, raw
 * items or links out. A raw item is `{ title, startDayKey, endDayKey }`, plus `regionId`
 * when the page itself names the city (TAT); `cityEventRules.acceptEvent` decides
 * what is stored.
 */

const { htmlToText } = require('./htmlText');
const { dayKeyFromDate } = require('./dayKey');
const { parseDayRange } = require('./cityEventRules');

const T21_ISO_RANGE_RE = /(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}\s*-\s*(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}/;
const NEXT_FLIGHT_RE = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
const PARAGON_EVENT_RE =
  /"title":("(?:[^"\\]|\\.)*"),"startDate":"([^"]+)","endDate":"([^"]+)"/g;

function firstText(html, re) {
  const m = re.exec(String(html));
  return m ? htmlToText(m[1]) : '';
}

function parseJsonString(literal) {
  try {
    return JSON.parse(literal);
  } catch {
    return '';
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unique(list) {
  return [...new Set(list)];
}

function isoDayKey(iso) {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : dayKeyFromDate(new Date(ms));
}

/** The city a TAT session sits in: Pattaya anywhere, or Bangkok as a place segment. */
function tatRegion(placeLines) {
  const place = placeLines.join(', ');
  if (/\bpattaya\b/i.test(place)) return 'pty';
  const segments = place.split(',').map((s) => s.trim());
  const last = segments[segments.length - 1] || '';
  if (segments.some((s) => /^bangkok$/i.test(s)) || /\bbangkok\b/i.test(last)) return 'bkk';
  return null;
}

/**
 * TAT monthly calendar post (WordPress content). Each event is a heading, then
 * paragraphs of `date<br>venue<br>province` — one per session — until `Highlights:`.
 * A touring event yields one item per Bangkok / Pattaya session.
 */
function readTatPost(html) {
  const items = [];
  for (const section of String(html).split(/<h[2-4]\b/i).slice(1)) {
    const title = firstText(section, /^[^>]*>([\s\S]*?)<\/h[2-4]>/i);
    if (!title) continue;
    let session = null;
    const flush = () => {
      const regionId = session && tatRegion(session.place);
      if (regionId) items.push({ regionId, title, ...session.range });
      session = null;
    };
    for (const paragraph of section.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
      const lines = paragraph[1].split(/<br\s*\/?>/i).map(htmlToText).filter(Boolean);
      if (lines.length > 0 && /^highlights?\b/i.test(lines[0])) break;
      for (const line of lines) {
        const range = parseDayRange(line);
        if (range) {
          flush();
          session = { range, place: [] };
        } else if (session) {
          session.place.push(line);
        }
      }
    }
    flush();
  }
  return items;
}

/** Event pages linked from a Terminal 21 WordPress archive (`…/pattaya/en/event/`). */
function t21EventLinks(html, archiveUrl) {
  const re = new RegExp(`${escapeRegExp(archiveUrl)}(?!page/)[^"'#?\\s<>/]+/`, 'g');
  return unique(String(html).match(re) || []);
}

/** Terminal 21 Pattaya / Rama 3 event page: `<h1>` and `2026-09-30 00:00 - 2026-10-04 23:59`. */
function readT21Event(html) {
  const title = firstText(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const m = T21_ISO_RANGE_RE.exec(String(html));
  return title && m ? [{ title, startDayKey: m[1], endDayKey: m[2] }] : [];
}

/** Terminal 21 Asok runs another CMS; its home page links `event/detail/{lang}/{id}/{slug}`. */
function t21AsokEventLinks(html, branchUrl) {
  return unique(
    Array.from(
      String(html).matchAll(/event\/detail\/(?:th|en)\/(\d+)\/([^"'#?\s<>]+)/g),
      (m) => `${branchUrl}event/detail/en/${m[1]}/${m[2]}`
    )
  );
}

/** Asok event page: `<div class="title">` and `<div class="date">09 Oct 26 - 19 Oct 26</div>`. */
function readT21AsokEvent(html) {
  const title = firstText(html, /<div class="title">([\s\S]*?)<\/div>/i);
  const range = parseDayRange(firstText(html, /<div class="date">([\s\S]*?)<\/div>/i));
  return title && range ? [{ title, ...range }] : [];
}

/** One Bangkok event pages in the sitemap, edited on or after `sinceDayKey`. */
function oneBangkokEventLinks(xml, sinceDayKey) {
  return unique(
    Array.from(
      String(xml).matchAll(
        /<loc>(https:\/\/www\.onebangkok\.com\/en\/whats-happening\/[^<\s]+)<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})/g
      ),
      (m) => (m[2] >= sinceDayKey ? m[1] : null)
    ).filter(Boolean)
  );
}

/** One Bangkok event page: `<h3 class="titleText">` and the calendar-icon line (`05 - 07 Oct 2026`). */
function readOneBangkokEvent(html) {
  const title = firstText(html, /<h3 class="titleText">([\s\S]*?)<\/h3>/i);
  const range = parseDayRange(firstText(html, /icon-ic-calendar[^>]*><\/i>([\s\S]*?)<\/p>/i));
  return title && range ? [{ title, ...range }] : [];
}

/**
 * Siam Paragon `/events` (Next.js). The first page of events rides in the RSC flight
 * strings: `"title":…,"startDate":"…Z","endDate":"…Z"`, read as Bangkok days.
 */
function readParagonEvents(html) {
  const flight = Array.from(String(html).matchAll(NEXT_FLIGHT_RE), (m) => parseJsonString(m[1])).join('');
  return Array.from(flight.matchAll(PARAGON_EVENT_RE), (m) => ({
    title: parseJsonString(m[1]),
    startDayKey: isoDayKey(m[2]),
    endDayKey: isoDayKey(m[3]),
  })).filter((item) => item.title && item.startDayKey && item.endDayKey);
}

module.exports = {
  readTatPost,
  t21EventLinks,
  readT21Event,
  t21AsokEventLinks,
  readT21AsokEvent,
  oneBangkokEventLinks,
  readOneBangkokEvent,
  readParagonEvents,
};
