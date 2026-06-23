/**
 * 11-life-resume 字素簇计数（正文/标题）
 * 须与 lifeResumeGraphemeCount.cjs 同步
 */

export const LIFE_ENTRY_BODY_MAX = 500;
export const LIFE_ENTRY_TITLE_MAX = 40;

/**
 * @param {string} text
 * @returns {number}
 */
export function countGraphemes(text) {
  const value = String(text ?? '');
  if (!value) return 0;
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let count = 0;
    for (const _ of segmenter.segment(value)) {
      count += 1;
    }
    return count;
  }
  return [...value].length;
}

/**
 * @param {string} body
 * @returns {{ ok: true, count: number } | { ok: false, error: string, code: string }}
 */
export function validateEntryBody(body) {
  const value = String(body ?? '').trim();
  if (!value) {
    return { ok: false, error: '请输入正文', code: 'INVALID_BODY' };
  }
  const count = countGraphemes(value);
  if (count > LIFE_ENTRY_BODY_MAX) {
    return {
      ok: false,
      error: `正文不能超过 ${LIFE_ENTRY_BODY_MAX} 字`,
      code: 'BODY_TOO_LONG',
    };
  }
  return { ok: true, count, value };
}

/**
 * @param {string|null|undefined} title
 * @returns {{ ok: true, value: string|null, count: number } | { ok: false, error: string, code: string }}
 */
export function validateEntryTitle(title) {
  if (title == null || title === '') {
    return { ok: true, value: null, count: 0 };
  }
  const value = String(title).trim();
  if (!value) {
    return { ok: true, value: null, count: 0 };
  }
  const count = countGraphemes(value);
  if (count > LIFE_ENTRY_TITLE_MAX) {
    return {
      ok: false,
      error: `标题不能超过 ${LIFE_ENTRY_TITLE_MAX} 字`,
      code: 'TITLE_TOO_LONG',
    };
  }
  return { ok: true, value, count };
}
