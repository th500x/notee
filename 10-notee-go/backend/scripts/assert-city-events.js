/**
 * Offline checks for City Events page readers and rules. No DB, no network.
 * Fixtures are trimmed copies of the live markup (2026-10-02).
 * Usage: node scripts/assert-city-events.js
 */

const assert = require('assert');
const {
  CITY_EVENT_REGION_IDS,
  parseDayRange,
  windowEndDayKey,
  cleanTitle,
  titleKey,
  acceptEvent,
  pickDistinct,
} = require('../lib/cityEventRules');
const {
  readTatPost,
  t21EventLinks,
  readT21Event,
  t21AsokEventLinks,
  readT21AsokEvent,
  oneBangkokEventLinks,
  readOneBangkokEvent,
  readParagonEvents,
} = require('../lib/cityEventPages');
const { CITY_EVENT_PUBLISHERS } = require('../lib/cityEventPublishers');

const range = (startDayKey, endDayKey = startDayKey) => ({ startDayKey, endDayKey });

assert.deepStrictEqual(CITY_EVENT_REGION_IDS, ['bkk', 'pty']);
assert.deepStrictEqual(
  CITY_EVENT_PUBLISHERS.map((p) => p.id),
  ['tat', 't21_pattaya', 't21_rama3', 't21_asok', 'siam_paragon', 'one_bangkok']
);

// Date lines as the publishers write them.
assert.deepStrictEqual(parseDayRange('2\u20134 October 2026'), range('2026-10-02', '2026-10-04'));
assert.deepStrictEqual(parseDayRange('7 October 2026'), range('2026-10-07'));
assert.deepStrictEqual(
  parseDayRange('30 September \u2013 4 October 2026'),
  range('2026-09-30', '2026-10-04')
);
assert.deepStrictEqual(
  parseDayRange('29 October 2026 \u2013 28 February 2027'),
  range('2026-10-29', '2027-02-28')
);
assert.deepStrictEqual(parseDayRange('27 December \u2013 2 January 2027'), range('2026-12-27', '2027-01-02'));
assert.deepStrictEqual(
  parseDayRange('9\u201318 October 2026 | 17:00\u201300:00 hrs'),
  range('2026-10-09', '2026-10-18')
);
assert.deepStrictEqual(parseDayRange('09 Oct 26 - 19 Oct 26'), range('2026-10-09', '2026-10-19'));
assert.deepStrictEqual(parseDayRange('Date : 9 \u2013 19 OCT 2026'), range('2026-10-09', '2026-10-19'));
assert.deepStrictEqual(parseDayRange('02 Oct - 15 Nov 2026'), range('2026-10-02', '2026-11-15'));
assert.deepStrictEqual(parseDayRange('27 Sep 2026'), range('2026-09-27'));
for (const bad of ['Highlights:', '10.00-22.00', '2026', '31 February 2027', '5\u20132 October 2026', '']) {
  assert.strictEqual(parseDayRange(bad), null, bad);
}

assert.strictEqual(windowEndDayKey('2026-10-02'), '2027-09-30');
assert.strictEqual(windowEndDayKey('2026-01-31'), '2026-12-31');

// Titles: English only, brands out, connectors only trimmed where a brand was.
assert.strictEqual(cleanTitle('Chang Music Connection presents FATCAT Marathon'), 'FATCAT Marathon');
assert.strictEqual(cleanTitle('Heineken x Pattaya Music Festival'), 'Pattaya Music Festival');
assert.strictEqual(cleanTitle('With Love Concert'), 'With Love Concert');
assert.strictEqual(cleanTitle('Chang Chui Night Market'), 'Chang Chui Night Market');
assert.strictEqual(cleanTitle('\u0e07\u0e32\u0e19\u0e27\u0e31\u0e14 Fair'), '');
assert.strictEqual(titleKey('The American Fair 2026'), titleKey('american fair'));

const today = '2026-10-02';
const event = (title, startDayKey, endDayKey, extra = {}) => ({
  regionId: 'bkk',
  title,
  startDayKey,
  endDayKey,
  ...extra,
});
assert.deepStrictEqual(
  acceptEvent(event('Food Fun Fest', '2026-10-01', '2026-10-05'), { venue: true, todayKey: today }),
  event('Food Fun Fest', '2026-10-01', '2026-10-05')
);
for (const [title, start, end] of [
  ['Fashion Brand Sale', '2026-10-01', '2026-10-05'],
  ['TGIF Pilates Mat', '2026-10-03', '2026-10-03'],
  ['WEEKEND SPECIAL: PLAY WITH OCTOBER', '2026-10-01', '2026-10-31'],
  ["Exclusive Mother's Day Deals", '2026-10-01', '2026-10-05'],
  ['Shop & Win 20%', '2026-10-01', '2026-10-05'],
  ['Christmas Village', '2026-10-01', '2026-12-31'],
]) {
  assert.strictEqual(acceptEvent(event(title, start, end), { venue: true, todayKey: today }), null, title);
}
assert.ok(acceptEvent(event('Bangkok Art Biennale', '2026-10-29', '2027-02-28'), { venue: false, todayKey: today }));
assert.strictEqual(acceptEvent(event('Craft Beer Fest', '2026-10-10', '2026-10-11'), { venue: false, todayKey: today }), null);
assert.strictEqual(acceptEvent(event('Ended Fair', '2026-09-20', '2026-10-01'), { venue: false, todayKey: today }), null);
assert.strictEqual(
  acceptEvent(event('Fair', '2026-10-10', '2026-10-11', { regionId: 'hkt' }), { venue: false, todayKey: today }),
  null
);

// One row per event: hand entry over venue over TAT; names inside each other count.
const distinct = pickDistinct([
  event('Bangkok International Fashion Week 2026', '2026-10-08', '2026-10-11', { publisher: 'tat' }),
  event('Siam Paragon Bangkok International Fashion Week 2026', '2026-10-08', '2026-10-11', {
    publisher: 'siam_paragon',
  }),
  event('American Fair', '2026-10-23', '2026-10-25', { publisher: 'tat' }),
  event('American Fair', '2026-10-23', '2026-10-25', { regionId: 'pty', publisher: 'tat' }),
  event('Pattaya Fireworks', '2026-11-27', '2026-11-28', { regionId: 'pty', publisher: 'tat' }),
  event('Pattaya Fireworks Festival', '2026-11-27', '2026-11-28', { regionId: 'pty', publisher: 'manual' }),
  event('Fireworks', '2026-12-31', '2026-12-31', { regionId: 'pty', publisher: 'tat' }),
  event('Food Fair', '2026-10-01', '2026-10-03', { publisher: 'one_bangkok' }),
]);
assert.deepStrictEqual(
  distinct.map((e) => `${e.regionId} ${e.title} ${e.publisher}`),
  [
    'bkk Food Fair one_bangkok',
    'bkk Siam Paragon Bangkok International Fashion Week 2026 siam_paragon',
    'bkk American Fair tat',
    'pty American Fair tat',
    'pty Pattaya Fireworks Festival manual',
    'pty Fireworks tat',
  ]
);

// TAT monthly calendar: a touring event keeps only its Bangkok / Pattaya sessions.
const tat = `<p class="wp-block-paragraph">October continues to bring … Highlights include the American Fair.</p>
<h3 id="h-american-fair" class="wp-block-heading"><mark class="has-inline-color">American Fair</mark></h3>
<p class="wp-block-paragraph">2&#8211;4 October 2026<br>Mayfair Market, Nakhon Ratchasima</p>
<p class="wp-block-paragraph">23&#8211;25 October 2026<br>Parc Paragon &amp; SCBX NEXT TECH, Siam Paragon, Bangkok</p>
<p class="wp-block-paragraph"><strong>Highlights:</strong><br>A vibrant American-themed fair, 1&#8211;2 November 2026<br>Bangkok</p>
<h3 id="h-ubon" class="wp-block-heading">UBON BOOK FAIR 15th Edition</h3>
<p class="wp-block-paragraph">3&#8211;11 October 2026<br>Sunee Tower<br>Ubon Ratchathani</p>
<h3 class="wp-block-heading">Pattaya International Music Festival</h3>
<p class="wp-block-paragraph">9&#8211;18 October 2026 | 17:00&#8211;00:00 hrs<br>Beach Road<br>Pattaya, Chon Buri</p>
<p class="wp-block-paragraph"><strong>Highlights:</strong><br>Live music on the beach.</p>
<h2>Northern Region</h2>`;
assert.deepStrictEqual(readTatPost(tat), [
  { regionId: 'bkk', title: 'American Fair', ...range('2026-10-23', '2026-10-25') },
  { regionId: 'pty', title: 'Pattaya International Music Festival', ...range('2026-10-09', '2026-10-18') },
]);

// Terminal 21 Pattaya / Rama 3 (WordPress).
const archive = 'https://www.terminal21.co.th/pattaya/en/event/';
const t21Listing = `<a href="${archive}dog-enjoy-pattaya-pet-fair-2026-en/">Dog</a>
<a href="${archive}dog-enjoy-pattaya-pet-fair-2026-en/"><img></a>
<a href="${archive}page/2/">2</a><a href="${archive}">All</a>
<a href="${archive}%e0%b8%87%e0%b8%b2%e0%b8%99/">TH</a>`;
assert.deepStrictEqual(t21EventLinks(t21Listing, archive), [
  `${archive}dog-enjoy-pattaya-pet-fair-2026-en/`,
  `${archive}%e0%b8%87%e0%b8%b2%e0%b8%99/`,
]);
const t21Page = `<title>Dog Enjoy Pattaya Pet Fair 2026 - Terminal 21 Pattaya</title>
<h1 class="post-title summary entry-title" >Dog Enjoy Pattaya Pet Fair 2026</h1>
<span class="ecwd-event-date" itemprop="startDate" content="2026-09-30T00:00">
  2026-09-30 00:00  - 2026-10-04 23:59 </span>`;
assert.deepStrictEqual(readT21Event(t21Page), [
  { title: 'Dog Enjoy Pattaya Pet Fair 2026', ...range('2026-09-30', '2026-10-04') },
]);
assert.deepStrictEqual(readT21Event('<h1>No date</h1>'), []);

// Terminal 21 Asok (its own CMS).
const asokBranch = 'https://www.terminal21.co.th/asok/';
assert.deepStrictEqual(
  t21AsokEventLinks(
    `<a href="event/detail/th/6225/dino-explorer">x</a><a href="https://www.terminal21.co.th/asok/event/detail/th/6225/dino-explorer">y</a>`,
    asokBranch
  ),
  [`${asokBranch}event/detail/en/6225/dino-explorer`]
);
const asokPage = `<div class="detail">
  <div class="title">DINO EXPLORER</div>
  <div class="date">
    09 Oct 26 - 19 Oct 26          </div>
  <div class="text"><strong>Date : </strong>9 &ndash; 19 OCT 2026<br />`;
assert.deepStrictEqual(readT21AsokEvent(asokPage), [
  { title: 'DINO EXPLORER', ...range('2026-10-09', '2026-10-19') },
]);

// One Bangkok (sitemap + AEM page).
const sitemap = `<url><loc>https://www.onebangkok.com/en/whats-happening/fortune-teller/</loc>
<lastmod>2026-09-29</lastmod></url>
<url><loc>https://www.onebangkok.com/en/whats-happening/so-much-a-matcha-market/</loc>
<lastmod>2026-04-25</lastmod></url>
<url><loc>https://www.onebangkok.com/en/dining/</loc><lastmod>2026-09-30</lastmod></url>`;
assert.deepStrictEqual(oneBangkokEventLinks(sitemap, '2026-06-04'), [
  'https://www.onebangkok.com/en/whats-happening/fortune-teller/',
]);
const oneBangkokPage = `<h3 class="titleText"> Fortune Teller by Julie Stephen Chheng </h3>
<div class="detail"> <p> <i class="icon-ic-calendar"></i> 02 Oct - 15 Nov 2026</p>
<a> <p> <i class="icon-ic-location"></i> One Bangkok </p> </a> </div>`;
assert.deepStrictEqual(readOneBangkokEvent(oneBangkokPage), [
  { title: 'Fortune Teller by Julie Stephen Chheng', ...range('2026-10-02', '2026-11-15') },
]);

// Siam Paragon (Next.js flight strings; UTC instants read as Bangkok days).
const flight = JSON.stringify(
  '5:["$","div",null,{"initialEventsPage":{"docs":[' +
    '{"id":182,"slug":"fw","title":"Siam Paragon Bangkok International Fashion Week 2026","startDate":"2026-10-08T12:00:00.000Z","endDate":"2026-10-11T12:00:00.000Z"},' +
    '{"id":9,"slug":"late","title":"Caf\\u00e9 Night","startDate":"2026-10-20T18:00:00.000Z","endDate":"2026-10-20T20:00:00.000Z"}]}}]'
);
const paragonPage = `<script>self.__next_f.push([1,${flight}])</script>`;
assert.deepStrictEqual(readParagonEvents(paragonPage), [
  { title: 'Siam Paragon Bangkok International Fashion Week 2026', ...range('2026-10-08', '2026-10-11') },
  { title: 'Caf\u00e9 Night', ...range('2026-10-21') },
]);

console.log('assert-city-events: ok');
