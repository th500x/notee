/**
 * 片段正文（body）搜索与替换算法 — Vite 前端 ESM
 * 须与 backend/utils/entryBodyFindReplace.cjs 保持同算法
 *
 * 搜索词上限：中文汉字与非汉字字符分别累计，任一侧超限即不允许搜索。
 * 匹配不区分大小写；替换文字按用户输入原样写入。
 */

export const FIND_QUERY_MAX_CHINESE = 5;
export const FIND_QUERY_MAX_OTHER = 10;

const HAN_CHAR = /\p{Script=Han}/u;

/**
 * @param {unknown} find
 * @returns {{ ok: boolean, value?: string, chineseCount?: number, otherCount?: number, error?: string, code?: string }}
 */
export function analyzeFindQuery(find) {
  const value = String(find ?? '');
  if (!value) {
    return { ok: false, error: '请输入要搜索的文字', code: 'INVALID_FIND_QUERY' };
  }
  if (!value.trim()) {
    return { ok: false, error: '搜索词不能只有空格', code: 'INVALID_FIND_QUERY' };
  }

  const chars = Array.from(value);
  let chineseCount = 0;
  for (const ch of chars) {
    if (HAN_CHAR.test(ch)) chineseCount += 1;
  }
  const otherCount = chars.length - chineseCount;

  if (chineseCount > FIND_QUERY_MAX_CHINESE) {
    return {
      ok: false,
      error: `搜索词最多 ${FIND_QUERY_MAX_CHINESE} 个中文字（当前 ${chineseCount}）`,
      code: 'INVALID_FIND_QUERY',
    };
  }
  if (otherCount > FIND_QUERY_MAX_OTHER) {
    return {
      ok: false,
      error: `搜索词最多 ${FIND_QUERY_MAX_OTHER} 个英文/数字等字符（当前 ${otherCount}）`,
      code: 'INVALID_FIND_QUERY',
    };
  }

  return { ok: true, value, chineseCount, otherCount };
}

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 不区分大小写的全局匹配（搜索词已由 analyzeFindQuery 保证非空） */
export function buildFindRegex(find) {
  return new RegExp(escapeRegExp(find), 'giu');
}

/**
 * @returns {number} 匹配次数（不含重叠匹配，与 applyBodyReplace 口径一致）
 */
export function countMatches(body, find) {
  const text = String(body ?? '');
  if (!text || !find) return 0;
  const matched = text.match(buildFindRegex(find));
  return matched ? matched.length : 0;
}

export function matchesFindQuery(body, find) {
  return countMatches(body, find) > 0;
}

/**
 * @returns {{ nextBody: string, count: number }}
 */
export function applyBodyReplace(body, find, replace) {
  const text = String(body ?? '');
  if (!text || !find) return { nextBody: text, count: 0 };
  const replacement = String(replace ?? '');
  let count = 0;
  const nextBody = text.replace(buildFindRegex(find), () => {
    count += 1;
    return replacement;
  });
  return { nextBody, count };
}
