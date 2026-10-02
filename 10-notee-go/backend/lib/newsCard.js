/**
 * Text card for a frozen monthly-board row (notee-go docs/06 §4).
 * Mozilla Readability reads the article. The card keeps the headline, publisher and date,
 * a standfirst, subheads and body text on one fixed-size page. A long article shrinks the
 * type first; past the smallest size every section keeps its opening and the rest
 * becomes "…".
 */

const fs = require('fs');
const { TZ_OFFSET_MS } = require('./dayKey');

/** Height stays under 4096 px: some phone GPUs cannot draw a taller bitmap. */
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 3240;
const PAD_X = 72;
const PAD_TOP = 88;
const PAD_BOTTOM = 72;
const FONT_MAX_PX = 36;
const FONT_MIN_PX = 28;
const MIN_BODY_WORDS = 30;
const GOTO_TIMEOUT_MS = 25_000;
const SETTLE_MS = 800;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Everything after one of these is a link list, not the article. */
const STOP_RE = /^(further reading|related( articles?| stories| posts| news| content| coverage)?|read more|read also|also read|see also|you may (also )?like|more (stories|news)|more from .{1,40}|recommended( for you)?|trending( now)?|latest (news|stories)|popular (news|stories)|tags?)\s*[:：]?$/i;
const SOCIAL_RE = /^(join|follow|receive|subscribe|sign up|like us|share this|download)\b/i;
const JUNK_RE = /^(advertisement|advertising|sponsored( content)?|ads?|share|print|email|comments?|discover more|read next|click here|loading\.*)\s*[:：]?$/i;
const CAPTION_RE = /[(\[]?\b(file )?(photo|image|picture)s?( by| courtesy( of)?)?\s*[:：]\s*[^.()[\]]{1,80}[)\]]?\.?$/i;
const READ_MORE_TAIL_RE = /\s*(…|\.\.\.)?\s*(read more|continue reading)\s*[›»>]*\s*$/i;

let readabilitySource = null;

function readability() {
  if (readabilitySource == null) {
    readabilitySource = fs.readFileSync(require.resolve('@mozilla/readability/Readability.js'), 'utf8');
  }
  return readabilitySource;
}

function wordCount(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function textKey(text) {
  return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function bangkokDate(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + TZ_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
}

function keepLine(text, titleKey) {
  if (!text) return false;
  if (JUNK_RE.test(text)) return false;
  if (SOCIAL_RE.test(text) && text.length < 160) return false;
  if (CAPTION_RE.test(text) && text.length < 320) return false;
  return textKey(text) !== titleKey;
}

/** Some sites mark subheads as a shouted paragraph. */
function isShout(text) {
  return text.length <= 100 && wordCount(text) >= 2 && /\p{Lu}/u.test(text) &&
    text === text.toUpperCase();
}

function dropReadMore(text) {
  return text.replace(READ_MORE_TAIL_RE, (tail) => (/…|\.\.\./.test(tail) ? '…' : '')).trim();
}

/**
 * Raw page blocks → card text. Pure, so scripts/assert-news.js can check it offline.
 * @param {{ blocks?: {tag:string,text:string,linkRatio:number}[], lines?: string[], byline?: string, excerpt?: string }} raw
 * @param {{ title: string, publisher: string, publishedAt: string, url: string }} row
 */
function buildCard(raw, row) {
  const titleKey = textKey(row.title);
  let blocks = [];
  for (const b of raw.blocks || []) {
    const text = String(b.text || '').trim();
    if (STOP_RE.test(text)) break;
    if (!keepLine(text, titleKey)) continue;
    // Inline "see also" headlines are whole links.
    if (b.linkRatio >= 0.8 && text.length < 240) continue;
    const tagged = /^h[1-6]$/.test(b.tag);
    const heading = (tagged && text.length <= 200) || (b.tag === 'p' && isShout(text));
    const kind = heading ? 'sub' : b.tag === 'li' ? 'li' : b.tag === 'blockquote' ? 'quote' : 'p';
    blocks.push({ kind, text, tagged });
  }

  const bodyWords = (list) => list.filter((b) => b.kind !== 'sub').reduce((n, b) => n + wordCount(b.text), 0);
  const lineWords = (raw.lines || []).reduce((n, line) => n + wordCount(line), 0);
  if (bodyWords(blocks) < lineWords * 0.4) {
    // Text split by <br> instead of <p>: fall back to Readability's own lines.
    blocks = [];
    for (const line of raw.lines || []) {
      const text = String(line || '').trim();
      if (STOP_RE.test(text)) break;
      if (keepLine(text, titleKey)) blocks.push({ kind: 'p', text, tagged: false });
    }
  }

  let standfirst = '';
  const first = blocks[0];
  if (first && first.tagged && first.text.length >= 60 && first.text.length <= 400) {
    standfirst = dropReadMore(blocks.shift().text);
  } else {
    const excerpt = dropReadMore(String(raw.excerpt || ''));
    const lead = textKey(blocks.filter((b) => b.kind === 'p').slice(0, 2).map((b) => b.text).join(' '));
    const head = textKey(excerpt).slice(0, 60);
    if (excerpt.length >= 40 && excerpt.length <= 320 && head && !lead.includes(head) &&
        textKey(excerpt) !== titleKey) {
      standfirst = excerpt;
    }
  }
  while (blocks.length && blocks[blocks.length - 1].kind === 'sub') blocks.pop();

  if (bodyWords(blocks) < MIN_BODY_WORDS) throw new Error('too little article text');

  let byline = String(raw.byline || '').replace(/^by\s+/i, '').replace(/\s+/g, ' ').trim();
  if (byline.length > 60 || /https?:|www\./i.test(byline) ||
      textKey(byline).startsWith(textKey(row.publisher))) {
    byline = '';
  }
  const meta = [row.publisher, bangkokDate(row.publishedAt), byline].filter(Boolean).join(' · ');
  return {
    title: row.title,
    meta,
    standfirst,
    blocks: blocks.map(({ kind, text }) => ({ kind, text })),
    host: hostOf(row.url),
  };
}

/* Runs inside the article page. No outer scope. */
function extractInPage() {
  /* global document, Readability */
  const article = new Readability(document.cloneNode(true)).parse();
  if (!article) return null;
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = article.content || '';
  const sel = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre';
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const blocks = [];
  doc.body.querySelectorAll(sel).forEach((el) => {
    if (el.closest('figure,figcaption,table,nav,aside')) return;
    if (el.parentElement && el.parentElement.closest(sel)) return;
    const text = clean(el.textContent);
    if (!text) return;
    let linked = 0;
    el.querySelectorAll('a').forEach((a) => { linked += clean(a.textContent).length; });
    blocks.push({ tag: el.tagName.toLowerCase(), text, linkRatio: linked / text.length });
  });
  const lines = String(article.textContent || '').split(/\n+/).map(clean).filter(Boolean);
  return { blocks, lines, byline: article.byline || '', excerpt: article.excerpt || '' };
}

/* Runs inside the card page. No outer scope. */
function layoutInPage(card, opt) {
  /* global document */
  const art = document.getElementById('art');
  const avail = opt.height - opt.padTop - opt.padBottom;
  const blocks = card.blocks;

  // A subhead travels with the paragraph after it.
  const sections = [[]];
  let heads = [];
  blocks.forEach((b, i) => {
    if (b.kind === 'sub') {
      if (heads.length === 0) sections.push([]);
      heads.push(i);
      return;
    }
    sections[sections.length - 1].push(heads.concat(i));
    heads = [];
  });
  const intro = blocks.length > 0 && blocks[0].kind !== 'sub';
  const secs = sections.filter((s) => s.length);
  const order = [];
  const longest = secs.reduce((n, s) => Math.max(n, s.length), 0);
  for (let r = 0; r <= longest; r += 1) {
    secs.forEach((s, si) => {
      const picks = si === 0 && intro ? (r === 0 ? [0, 1] : [r + 1]) : [r];
      picks.forEach((u) => { if (u < s.length) order.push({ sec: si, idxs: s[u] }); });
    });
  }

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    e.textContent = text;
    return e;
  };
  const build = (keep, cut) => {
    art.textContent = '';
    art.appendChild(el('div', 'meta', card.meta));
    art.appendChild(el('h1', '', card.title));
    if (card.standfirst) art.appendChild(el('div', 'stand', card.standfirst));
    let list = null;
    let skipped = false;
    blocks.forEach((b, i) => {
      if (keep && !keep.has(i)) {
        skipped = true;
        list = null;
        return;
      }
      if (skipped) {
        art.appendChild(el('div', 'gap', '…'));
        skipped = false;
      }
      let text = b.text;
      if (cut && cut.index === i) text = `${text.split(/\s+/).slice(0, cut.words).join(' ')} …`;
      if (b.kind === 'li') {
        if (!list) {
          list = document.createElement('ul');
          art.appendChild(list);
        }
        list.appendChild(el('li', '', text));
        return;
      }
      list = null;
      const tag = b.kind === 'sub' ? 'h2' : b.kind === 'quote' ? 'blockquote' : 'p';
      art.appendChild(el(tag, '', text));
    });
    if (skipped) art.appendChild(el('div', 'gap', '…'));
    if (card.host) art.appendChild(el('div', 'foot', card.host));
  };
  const fits = () => art.offsetHeight <= avail;
  const setFont = (px) => { art.style.fontSize = `${px}px`; };

  build(null, null);
  setFont(opt.fontMax);
  if (fits()) return { fontPx: opt.fontMax, trimmed: false };
  setFont(opt.fontMin);
  if (fits()) {
    let lo = opt.fontMin;
    let hi = opt.fontMax;
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2;
      setFont(mid);
      if (fits()) lo = mid;
      else hi = mid;
    }
    setFont(lo);
    return { fontPx: lo, trimmed: false };
  }

  // Smallest type and still too long: fill in priority order. A section that misses one
  // paragraph takes no later ones, so what is kept always reads straight on.
  const kept = new Set();
  const closed = new Set();
  order.forEach((unit) => {
    if (closed.has(unit.sec)) return;
    const next = new Set(kept);
    unit.idxs.forEach((i) => next.add(i));
    build(next, null);
    if (fits()) unit.idxs.forEach((i) => kept.add(i));
    else closed.add(unit.sec);
  });
  if (kept.size > 0) {
    build(kept, null);
    return { fontPx: opt.fontMin, trimmed: true };
  }
  // Even the first paragraph is too long: cut it by words.
  const unit = order.length ? order[0].idxs : [];
  const idx = unit[unit.length - 1];
  const keep = new Set(unit);
  let wlo = 1;
  let whi = idx == null ? 1 : blocks[idx].text.split(/\s+/).length;
  while (whi - wlo > 1) {
    const mid = (wlo + whi) >> 1;
    build(keep, { index: idx, words: mid });
    if (fits()) wlo = mid;
    else whi = mid;
  }
  build(keep, idx == null ? null : { index: idx, words: wlo });
  return { fontPx: opt.fontMin, trimmed: true };
}

const CARD_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#f6f1e7}
#page{width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;box-sizing:border-box;padding:${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px;overflow:hidden}
#art{font-family:'Liberation Serif','DejaVu Serif',serif;line-height:1.5;color:#1f1c18;overflow-wrap:break-word}
.meta{font-family:'Liberation Sans','DejaVu Sans',sans-serif;font-size:.7em;line-height:1.4;color:#7a7064;margin:0 0 .8em}
h1{font-size:1.6em;line-height:1.22;font-weight:700;margin:0 0 .55em}
.stand{font-size:1.06em;line-height:1.45;font-style:italic;color:#4a433a;margin:0 0 1.1em;padding-left:.7em;border-left:.16em solid #c9a35c}
h2{font-size:1.05em;line-height:1.32;font-weight:700;margin:1.05em 0 .4em}
p{margin:0 0 .7em}
ul{margin:0 0 .7em;padding-left:1.2em}
li{margin:0 0 .3em}
blockquote{margin:0 0 .7em;padding-left:.8em;border-left:.1em solid #b8ad9c;color:#3d372f}
.gap{text-align:center;color:#a39886;margin:0 0 .7em;letter-spacing:.3em}
.foot{font-family:'Liberation Sans','DejaVu Sans',sans-serif;font-size:.6em;color:#a39886;margin-top:1.2em}
</style></head><body><div id="page"><div id="art"></div></div></body></html>`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readArticle(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setBypassCSP(true);
    await page.setUserAgent(USER_AGENT);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'image' || type === 'media' || type === 'font') req.abort().catch(() => {});
      else req.continue().catch(() => {});
    });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: GOTO_TIMEOUT_MS });
    } catch (err) {
      // A slow ad script can hold the load event after the article text is already in.
      if (err.name !== 'TimeoutError') throw err;
    }
    await sleep(SETTLE_MS);
    await page.addScriptTag({ content: readability() });
    const raw = await page.evaluate(extractInPage);
    if (!raw) throw new Error('no readable article');
    return raw;
  } finally {
    await page.close().catch(() => {});
  }
}

/** @returns {Promise<{ buf: Buffer, fontPx: number, trimmed: boolean }>} */
async function renderCard(browser, card) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: CARD_WIDTH, height: CARD_HEIGHT, deviceScaleFactor: 1 });
    await page.setContent(CARD_HTML, { waitUntil: 'load' });
    const fit = await page.evaluate(layoutInPage, card, {
      height: CARD_HEIGHT,
      padTop: PAD_TOP,
      padBottom: PAD_BOTTOM,
      fontMax: FONT_MAX_PX,
      fontMin: FONT_MIN_PX,
    });
    const buf = await page.screenshot({
      type: 'jpeg',
      quality: 85,
      clip: { x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT },
    });
    return { buf, ...fit };
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = {
  CARD_WIDTH,
  CARD_HEIGHT,
  FONT_MAX_PX,
  FONT_MIN_PX,
  buildCard,
  bangkokDate,
  readArticle,
  renderCard,
};
