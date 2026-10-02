/**
 * Who City Events are read from (notee-go docs/01-26-6 §7). `publishers.id` is the
 * `city_events.publisher` value; hand-entered rows use `manual`.
 *
 * `pages(getText, knownUrls, todayKey)` resolves to `{ url, text?, gone? }[]`: `text`
 * when a listing call already carried the page, `gone` when the publisher says it no
 * longer exists. `knownUrls` are pages that still hold stored rows, so a moved or
 * cancelled date is seen after the listing drops the page. `read(text)` turns one
 * page into raw items; `regionId` and `place` fill in when the page does not name
 * the city or the venue.
 * Network goes through the `getText` the service passes in; nothing here touches the DB.
 */

const { TAT_PUBLISHER } = require('./cityEventRules');
const {
  readTatPost,
  t21EventLinks,
  readT21Event,
  t21AsokEventLinks,
  readT21AsokEvent,
  oneBangkokEventLinks,
  readOneBangkokEvent,
  readParagonEvents,
} = require('./cityEventPages');

const DAY_MS = 24 * 60 * 60 * 1000;
const T21 = 'https://www.terminal21.co.th';
const TAT_POSTS_API = 'https://www.tatnews.org/wp-json/wp/v2/posts';
/** TAT Newsroom category "Events & Festivals": monthly calendars and single festivals. */
const TAT_EVENTS_CATEGORY = 263;
const TAT_LOOKBACK_DAYS = 150;
const ONE_BANGKOK_SITEMAP = 'https://www.onebangkok.com/en.sitemap.xml';
const ONE_BANGKOK_LOOKBACK_DAYS = 120;
const PARAGON_EVENTS = 'https://www.siamparagon.co.th/events';

function pagesFor(urls) {
  return [...new Set(urls)].map((url) => ({ url }));
}

function dayKeyBefore(todayKey, days) {
  return new Date(Date.parse(`${todayKey}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
}

/** A listing page past the last one answers 404; that is an empty page, not a failure. */
async function optionalText(getText, url) {
  try {
    return await getText(url);
  } catch (err) {
    if (err.status === 404) return '';
    throw err;
  }
}

async function tatPages(getText, knownUrls, todayKey) {
  const after = `${dayKeyBefore(todayKey, TAT_LOOKBACK_DAYS)}T00:00:00`;
  const listed = JSON.parse(
    await getText(
      `${TAT_POSTS_API}?categories=${TAT_EVENTS_CATEGORY}&after=${after}&per_page=50&_fields=link,content`
    )
  );
  const pages = listed.map((post) => ({ url: post.link, text: post.content.rendered }));
  const missing = knownUrls.filter((url) => !pages.some((page) => page.url === url));
  if (missing.length === 0) return pages;
  const slugs = missing.map((url) => url.replace(/\/+$/, '').split('/').pop());
  const found = JSON.parse(
    await getText(`${TAT_POSTS_API}?slug=${slugs.map(encodeURIComponent).join(',')}&per_page=50&_fields=link,content`)
  );
  for (const url of missing) {
    const post = found.find((row) => row.link === url);
    pages.push(post ? { url, text: post.content.rendered } : { url, gone: true });
  }
  return pages;
}

/** Terminal 21 Pattaya and Rama 3 share one WordPress events archive. */
function terminal21(id, branch, regionId, place) {
  const archiveUrl = `${T21}/${branch}/en/event/`;
  return {
    id,
    regionId,
    place,
    venue: true,
    async pages(getText, knownUrls) {
      const listings = await Promise.all(
        [archiveUrl, `${archiveUrl}page/2/`].map((url) => optionalText(getText, url))
      );
      return pagesFor([...listings.flatMap((html) => t21EventLinks(html, archiveUrl)), ...knownUrls]);
    },
    read: readT21Event,
  };
}

const CITY_EVENT_PUBLISHERS = [
  {
    id: TAT_PUBLISHER,
    regionId: null,
    place: null,
    venue: false,
    pages: tatPages,
    read: readTatPost,
  },
  terminal21('t21_pattaya', 'pattaya', 'pty', 'Terminal 21 Pattaya'),
  terminal21('t21_rama3', 'rama3', 'bkk', 'Terminal 21 Rama 3'),
  {
    id: 't21_asok',
    regionId: 'bkk',
    place: 'Terminal 21 Asok',
    venue: true,
    async pages(getText, knownUrls) {
      const branchUrl = `${T21}/asok/`;
      return pagesFor([...t21AsokEventLinks(await getText(branchUrl), branchUrl), ...knownUrls]);
    },
    read: readT21AsokEvent,
  },
  {
    id: 'siam_paragon',
    regionId: 'bkk',
    place: 'Siam Paragon',
    venue: true,
    async pages() {
      return pagesFor([PARAGON_EVENTS]);
    },
    read: readParagonEvents,
  },
  {
    id: 'one_bangkok',
    regionId: 'bkk',
    place: 'One Bangkok',
    venue: true,
    async pages(getText, knownUrls, todayKey) {
      const since = dayKeyBefore(todayKey, ONE_BANGKOK_LOOKBACK_DAYS);
      return pagesFor([...oneBangkokEventLinks(await getText(ONE_BANGKOK_SITEMAP), since), ...knownUrls]);
    },
    read: readOneBangkokEvent,
  },
];

module.exports = {
  CITY_EVENT_PUBLISHERS,
};
