/**
 * News Notes regions and RSS feeds (notee-go docs/06 §1–§2).
 * Every URL answers from the Bangkok host; Bangkok Post returns 451 there.
 */

/**
 * Same ids as Go `NewsRegion`. `th` is country-wide; the rest map to Thai city STAMPs.
 * Chiang Mai / Samui / Krabi stay out: no English feed refills them daily (docs/06 §2).
 */
const NEWS_REGION_IDS = Object.freeze(['th', 'bkk', 'pty', 'hkt']);

const THAIGER = 'Thaiger';

const NEWS_FEEDS = Object.freeze([
  { regionId: 'th', publisher: THAIGER, url: 'https://thethaiger.com/news/national/feed' },
  { regionId: 'th', publisher: 'Khaosod English', url: 'https://www.khaosodenglish.com/feed/' },
  { regionId: 'th', publisher: 'Thai Examiner', url: 'https://www.thaiexaminer.com/feed/' },
  { regionId: 'bkk', publisher: THAIGER, url: 'https://thethaiger.com/news/bangkok/feed' },
  { regionId: 'pty', publisher: THAIGER, url: 'https://thethaiger.com/news/pattaya/feed' },
  { regionId: 'pty', publisher: 'The Pattaya News', url: 'https://thepattayanews.com/feed/' },
  { regionId: 'hkt', publisher: THAIGER, url: 'https://thethaiger.com/news/phuket/feed' },
  {
    regionId: 'hkt',
    publisher: 'The Phuket News',
    url: 'https://www.thephuketnews.com/rss-xml/news.xml',
  },
]);

module.exports = {
  NEWS_REGION_IDS,
  NEWS_FEEDS,
};
