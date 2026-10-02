/**
 * RSS 2.0 item reader for News Notes. The feeds are flat WordPress / CMS
 * exports, so a regex over <item> blocks is enough and keeps the backend
 * free of an XML dependency.
 */

const { decodeEntities, htmlToText } = require('./htmlText');

const ITEM_RE = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
/** The Phuket News puts photo captions in <image><title>; media blocks can do the same. */
const NESTED_RE = /<(image|source|media:[\w-]+)\b[^>]*>[\s\S]*?<\/\1>/gi;
const CDATA_RE = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/;

/**
 * Plain text of one element. CDATA holds HTML as-is; plain content is XML-escaped
 * HTML, so it decodes twice (Bangkok-Post style `&amp;rsquo;`).
 */
function elementText(raw) {
  const cdata = raw.match(CDATA_RE);
  return htmlToText(cdata ? cdata[1] : decodeEntities(raw));
}

function elementRegex(tag, flags) {
  return new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, flags);
}

function firstElement(block, tag) {
  const match = block.match(elementRegex(tag, 'i'));
  return match ? elementText(match[1]) : '';
}

function allElements(block, tag) {
  return Array.from(block.matchAll(elementRegex(tag, 'gi')), (match) => elementText(match[1]));
}

/**
 * Items in feed order. Missing fields come back empty (`''` / `null`);
 * `newsRules.freshItems` decides what is stored.
 * @returns {{ title: string, url: string, publishedAt: Date|null, categories: string[] }[]}
 */
function parseRssItems(xml) {
  if (typeof xml !== 'string') return [];
  return Array.from(xml.matchAll(ITEM_RE), (match) => {
    const block = match[1].replace(NESTED_RE, '');
    const published = Date.parse(firstElement(block, 'pubDate'));
    return {
      title: firstElement(block, 'title'),
      url: firstElement(block, 'link'),
      publishedAt: Number.isNaN(published) ? null : new Date(published),
      categories: allElements(block, 'category'),
    };
  });
}

module.exports = {
  parseRssItems,
};
