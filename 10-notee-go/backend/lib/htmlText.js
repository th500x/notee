/**
 * Plain text out of HTML / XML fragments. Shared by the RSS reader, the City Events
 * page readers and the translation proxy, so every reader decodes the same entities.
 */

const TAG_RE = /<[^>]*>/g;
const ENTITY_RE = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const INVISIBLE_RE = /[\u200B-\u200D\uFEFF]/g;
const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201C',
  rdquo: '\u201D',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
};

/** One pass, so `&amp;lt;` becomes `&lt;`, not `<`. Unknown names stay as written. */
function decodeEntities(text) {
  return String(text ?? '').replace(ENTITY_RE, (whole, body) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

/** Tags become spaces; entities decode; zero-width marks go; whitespace collapses. */
function htmlToText(html) {
  return decodeEntities(String(html ?? '').replace(TAG_RE, ' '))
    .replace(INVISIBLE_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFC');
}

module.exports = {
  decodeEntities,
  htmlToText,
};
