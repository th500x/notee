/**
 * 11-life-resume 条目标签白名单
 * 须与 lifeResumeEntryTags.js 同步
 */

const LIFE_ENTRY_TAGS = ['学业', '工作', '游记', '家庭', '人生'];

const TAG_SET = new Set(LIFE_ENTRY_TAGS);

function normalizeEntryTags(raw) {
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

module.exports = {
  LIFE_ENTRY_TAGS,
  normalizeEntryTags,
};
