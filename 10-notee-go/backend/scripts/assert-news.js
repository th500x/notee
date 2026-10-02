/**
 * Offline checks for News Notes feed parsing and rules. No DB, no network.
 * Usage: node scripts/assert-news.js
 */

const assert = require('assert');
const { NEWS_REGION_IDS, NEWS_FEEDS } = require('../lib/newsFeeds');
const { parseRssItems } = require('../lib/newsRss');
const {
  LATEST_SIZE,
  BOARD_SIZE,
  TITLE_MAX,
  assertRegionId,
  slotStart,
  freshItems,
} = require('../lib/newsRules');
const { CARD_HEIGHT, buildCard, bangkokDate } = require('../lib/newsCard');
const { googleTarget, sameLanguage, decodeEntities } = require('../lib/translateText');

assert.deepStrictEqual(NEWS_REGION_IDS, ['th', 'bkk', 'pty', 'hkt']);
assert.strictEqual(LATEST_SIZE, 8);
assert.strictEqual(BOARD_SIZE, 10);
for (const id of NEWS_REGION_IDS) {
  assert.ok(NEWS_FEEDS.some((feed) => feed.regionId === id), `no feed for ${id}`);
}
for (const feed of NEWS_FEEDS) {
  assert.ok(NEWS_REGION_IDS.includes(feed.regionId), feed.url);
  assert.ok(feed.publisher.length <= 40, feed.publisher);
}

// WordPress (Thaiger): XML numeric entity in the title, channel <image><title> ignored.
const wordpress = `<?xml version="1.0"?><rss version="2.0"><channel>
<title>Bangkok News | Thaiger</title>
<image><title>Thaiger logo</title></image>
<item>
  <title>Thailand revokes Israeli man&#8217;s Thai citizenship</title>
  <link>https://thethaiger.com/news/national/a</link>
  <dc:creator><![CDATA[Desk]]></dc:creator>
  <pubDate>Thu, 01 Oct 2026 09:39:02 +0000</pubDate>
  <category><![CDATA[Bangkok News]]></category>
</item>
</channel></rss>`;
assert.deepStrictEqual(parseRssItems(wordpress), [
  {
    title: 'Thailand revokes Israeli man\u2019s Thai citizenship',
    url: 'https://thethaiger.com/news/national/a',
    publishedAt: new Date('2026-10-01T09:39:02Z'),
    categories: ['Bangkok News'],
  },
]);

// The Phuket News: CDATA title, ISO minute time, photo caption inside the item's <image>.
const phuket = `<rss><channel><item>
  <title><![CDATA[New Phuket police chief takes charge]]></title>
  <link>https://www.thephuketnews.com/x-101796.php</link>
  <pubDate>2026-10-01T14:05+07:00</pubDate>
  <image><url>https://x/1.jpg</url><title><![CDATA[Photo: PR Phuket]]></title></image>
</item></channel></rss>`;
const [phuketItem] = parseRssItems(phuket);
assert.strictEqual(phuketItem.title, 'New Phuket police chief takes charge');
assert.strictEqual(phuketItem.publishedAt.toISOString(), '2026-10-01T07:05:00.000Z');

// Double-escaped HTML entity, zero-width space, inline tags, query-string ampersand.
const messy = `<rss><item>
  <title>\u200BFlood &amp;rsquo;relief&amp;rsquo; &lt;b&gt;now&lt;/b&gt;</title>
  <link>https://example.com/a?b=1&amp;c=2</link>
  <pubDate>not a date</pubDate>
</item></rss>`;
const [messyItem] = parseRssItems(messy);
assert.strictEqual(messyItem.title, 'Flood \u2019relief\u2019 now');
assert.strictEqual(messyItem.url, 'https://example.com/a?b=1&c=2');
assert.strictEqual(messyItem.publishedAt, null);

assert.deepStrictEqual(parseRssItems('<!DOCTYPE html><html></html>'), []);
assert.deepStrictEqual(parseRssItems(undefined), []);

// freshItems: 24h window, future clamp, required fields, skipped categories.
const now = new Date('2026-10-01T12:00:00Z');
const base = { categories: [] };
const fresh = freshItems(
  [
    { ...base, title: 'Recent', url: 'https://a/1', publishedAt: new Date('2026-10-01T10:00:00Z') },
    { ...base, title: 'Future', url: 'https://a/2', publishedAt: new Date('2026-10-01T15:00:00Z') },
    { ...base, title: 'Edge', url: 'https://a/3', publishedAt: new Date('2026-09-30T12:00:00Z') },
    { ...base, title: 'Old', url: 'https://a/4', publishedAt: new Date('2026-09-30T11:59:59Z') },
    { ...base, title: 'No date', url: 'https://a/5', publishedAt: null },
    { ...base, title: '', url: 'https://a/6', publishedAt: now },
    { ...base, title: 'Bad link', url: 'ftp://a/7', publishedAt: now },
    { ...base, title: 'x'.repeat(TITLE_MAX + 1), url: 'https://a/8', publishedAt: now },
    { title: 'Ad', url: 'https://a/9', publishedAt: now, categories: ['Local', 'Sponsored'] },
    { title: 'Column', url: 'https://a/10', publishedAt: now, categories: ['OPINION'] },
  ],
  now
);
assert.deepStrictEqual(
  fresh.map((item) => [item.title, item.publishedAt.toISOString()]),
  [
    ['Recent', '2026-10-01T10:00:00.000Z'],
    ['Future', '2026-10-01T12:00:00.000Z'],
    ['Edge', '2026-09-30T12:00:00.000Z'],
  ]
);

// Slots start on UTC+7 even hours: Bangkok 00:00 = 17:00Z, 02:00 = 19:00Z.
assert.strictEqual(slotStart(new Date('2026-09-30T17:00:00Z')).toISOString(), '2026-09-30T17:00:00.000Z');
assert.strictEqual(slotStart(new Date('2026-09-30T18:59:59Z')).toISOString(), '2026-09-30T17:00:00.000Z');
assert.strictEqual(slotStart(new Date('2026-09-30T19:00:00Z')).toISOString(), '2026-09-30T19:00:00.000Z');
assert.strictEqual(slotStart(new Date('2026-10-01T12:00:00Z')).toISOString(), '2026-10-01T11:00:00.000Z');

assert.strictEqual(assertRegionId('bkk'), 'bkk');
for (const bad of [undefined, '', 'BKK', 'cri', ['bkk']]) {
  assert.throws(() => assertRegionId(bad), (err) => err.code === 'NEWS_BAD_REGION');
}

// Monthly-board text card: what survives from the page.
assert.ok(CARD_HEIGHT < 4096);
assert.strictEqual(bangkokDate('2026-09-30T18:30:00Z'), '1 Oct 2026');
assert.strictEqual(bangkokDate('nope'), '');
{
  const body = 'Officials said the backlog would clear by the end of the week as crews worked overnight.';
  const card = buildCard({
    blocks: [
      { tag: 'h4', text: 'Ministers step in as thousands of bags stay stranded and flights remain… Read More ›', linkRatio: 0 },
      { tag: 'p', text: 'Discover more', linkRatio: 0 },
      { tag: 'p', text: body, linkRatio: 0 },
      { tag: 'p', text: 'The minister visits the airport last month. Photo: Ministry of Transport', linkRatio: 0 },
      { tag: 'p', text: 'AIR FORCE SENDS MORE CREWS', linkRatio: 0 },
      { tag: 'p', text: `${body} ${body}`, linkRatio: 0 },
      { tag: 'h5', text: 'Probe into 11,000 firms to be complete by Sept 30th', linkRatio: 1 },
      { tag: 'p', text: 'Advertisement', linkRatio: 0 },
      { tag: 'h5', text: 'Follow Thai Examiner on Google here', linkRatio: 0.1 },
      { tag: 'h4', text: 'Further reading:', linkRatio: 0 },
      { tag: 'p', text: 'Another story headline that is only a link', linkRatio: 0 },
    ],
    lines: [],
    byline: 'By Joseph O\' Connor',
    excerpt: 'unused',
  }, {
    title: 'Government takes a stronger hand',
    publisher: 'Thai Examiner',
    publishedAt: '2026-09-30T03:00:00Z',
    url: 'https://www.thaiexaminer.com/x',
  });
  assert.strictEqual(card.standfirst, 'Ministers step in as thousands of bags stay stranded and flights remain…');
  assert.deepStrictEqual(card.blocks.map((b) => b.kind), ['p', 'sub', 'p']);
  assert.strictEqual(card.meta, 'Thai Examiner · 30 Sep 2026 · Joseph O\' Connor');
  assert.strictEqual(card.host, 'thaiexaminer.com');
  const house = buildCard({ blocks: [{ tag: 'p', text: `${body} ${body} ${body}`, linkRatio: 0 }], byline: 'The Phuket News Com' }, {
    title: 'T', publisher: 'The Phuket News', publishedAt: '', url: 'https://www.thephuketnews.com/x',
  });
  assert.strictEqual(house.meta, 'The Phuket News');
  assert.throws(
    () => buildCard({ blocks: [{ tag: 'p', text: 'Too short.', linkRatio: 0 }] }, {
      title: 'T', publisher: 'P', publishedAt: '', url: 'https://a.b/',
    }),
    /too little/
  );
}

assert.strictEqual(googleTarget('zh'), 'zh-CN');
assert.strictEqual(googleTarget('en'), 'en');
assert.strictEqual(googleTarget('th'), null);
assert.strictEqual(sameLanguage('zh', 'zh-CN'), true);
assert.strictEqual(sameLanguage('en', 'zh-CN'), false);
assert.strictEqual(decodeEntities('a &amp; b &#39;c&#39;'), "a & b 'c'");

console.log('assert-news: ok');
