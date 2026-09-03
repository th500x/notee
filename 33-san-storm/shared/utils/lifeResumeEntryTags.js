/**
 * 11-life-resume 条目标签白名单
 * 须与 lifeResumeEntryTags.cjs 同步
 */

export const LIFE_ENTRY_TAGS = ['学业', '工作', '游记', '家庭', '人生'];

/** 时间轴标签统计展示顺序（含未打标签） */
export const LIFE_ENTRY_TAG_STATS_LABELS = [...LIFE_ENTRY_TAGS, '无'];

const TAG_SET = new Set(LIFE_ENTRY_TAGS);

/**
 * @param {unknown} raw
 * @returns {{ ok: true, tags: string[] } | { ok: false, error: string, code: string }}
 */
export function normalizeEntryTags(raw) {
  if (raw == null) {
    return { ok: true, tags: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: '标签格式无效', code: 'INVALID_TAGS' };
  }
  const seen = new Set();
  const tags = [];
  for (const item of raw) {
    const tag = String(item ?? '').trim();
    if (!tag) continue;
    if (!TAG_SET.has(tag)) {
      return { ok: false, error: `标签「${tag}」不在允许范围内`, code: 'INVALID_TAGS' };
    }
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return { ok: true, tags };
}

/**
 * 统计当前时间轴可见条目各标签数量（单选标签；无标签计入「无」）。
 * @param {Array<{ tags?: string[] }>} entries
 * @returns {Array<{ label: string, count: number }>}
 */
export function countEntryTagStats(entries) {
  const counts = Object.fromEntries(LIFE_ENTRY_TAGS.map((tag) => [tag, 0]));
  counts['无'] = 0;

  for (const entry of entries || []) {
    const tags = Array.isArray(entry?.tags) ? entry.tags : [];
    const raw = tags[0] ? String(tags[0]).trim() : '';
    const tag = raw === '旅行' ? '游记' : raw;
    if (tag && Object.prototype.hasOwnProperty.call(counts, tag) && tag !== '无') {
      counts[tag] += 1;
    } else {
      counts['无'] += 1;
    }
  }

  return LIFE_ENTRY_TAG_STATS_LABELS.map((label) => ({
    label,
    count: counts[label] || 0,
  }));
}
