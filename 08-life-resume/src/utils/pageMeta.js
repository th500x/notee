const DEFAULT_TITLE = '人生片段';
const DEFAULT_ROBOTS = 'noindex, nofollow';

function findMeta(attrName, attrValue) {
  return document.querySelector(`meta[${attrName}="${attrValue}"]`);
}

export function upsertMeta(attrName, attrValue, content) {
  if (content == null || content === '') {
    const existing = findMeta(attrName, attrValue);
    if (existing) existing.remove();
    return;
  }
  let el = findMeta(attrName, attrValue);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function resetPageMeta() {
  document.title = DEFAULT_TITLE;
  upsertMeta('name', 'robots', DEFAULT_ROBOTS);
  upsertMeta('name', 'description', null);
}

/**
 * @param {Array<{ visibility?: string, status?: string, title?: string, body?: string }>} entries
 */
export function buildPublicSeoFromEntries(entries, { displayName, username, accountId }) {
  const name = displayName || username || accountId || '用户';
  const publicPublished = (entries || []).filter(
    (entry) =>
      entry.visibility === 'public' && (!entry.status || entry.status === 'published')
  );

  if (publicPublished.length === 0) {
    return {
      title: DEFAULT_TITLE,
      description: null,
      robots: DEFAULT_ROBOTS,
    };
  }

  const first = publicPublished[0];
  const raw = `${first.title ? `${first.title} — ` : ''}${first.body || ''}`;
  const description =
    raw.replace(/\s+/g, ' ').trim().slice(0, 120) ||
    `${name} 的人生片段时间轴`;

  return {
    title: `${name} 的人生片段`,
    description,
    robots: 'index, follow',
  };
}

export { DEFAULT_TITLE, DEFAULT_ROBOTS };
