/**
 * 11-life-resume · lifePath（人生轨迹）校验与渲染
 * 须与 lifeResumeLifePath.cjs 同步
 */

import { countGraphemes } from './lifeResumeGraphemeCount.js';

export const LIFE_PATH_TOTAL_MAX = 500;
export const LIFE_PATH_NODE_MIN = 20;
export const LIFE_PATH_NODE_MAX = 50;

export const LIFE_PATH_CATEGORIES = [
  'location',
  'family',
  'work',
  'relationship',
  'study',
  'other',
];

const CATEGORY_SET = new Set(LIFE_PATH_CATEGORIES);

export const LIFE_PATH_CATEGORY_LABELS = {
  location: '所在地',
  family: '家庭',
  work: '工作',
  relationship: '人际关系',
  study: '学业',
  other: '其他',
};

const SENSITIVE_PATTERNS = [
  /犯罪/,
  /被捕/,
  /坐牢/,
  /判刑/,
  /猥亵/,
  /强奸/,
  /吸毒/,
  /贩毒/,
];

function normalizeDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : null;
  if (!nodes) return null;
  return {
    nodes: nodes.map((node, index) => ({
      sortOrder: Number(node?.sortOrder ?? index + 1),
      timeLabel: String(node?.timeLabel ?? '').trim(),
      category: String(node?.category ?? '').trim(),
      text: String(node?.text ?? '').trim(),
    })),
    summaryText: raw.summaryText != null ? String(raw.summaryText).trim() : '',
    sourceEntryIds: Array.isArray(raw.sourceEntryIds)
      ? raw.sourceEntryIds.map((id) => String(id))
      : [],
    model: raw.model != null ? String(raw.model) : null,
    generatedAt: raw.generatedAt != null ? String(raw.generatedAt) : null,
  };
}

function collectVisibleParts(draft) {
  const parts = [];
  for (const node of draft.nodes) {
    if (node.text) parts.push(node.text);
  }
  if (draft.summaryText) parts.push(draft.summaryText);
  return parts;
}

function findSensitiveSnippet(text) {
  const value = String(text ?? '');
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(value)) {
      return pattern.source;
    }
  }
  return null;
}

export function truncateTextForLifePathPrompt(text, maxChars) {
  const limit = Math.max(1, Number(maxChars) || 400);
  const value = String(text ?? '').trim();
  if (!value) return '';
  if (countGraphemes(value) <= limit) return value;
  let out = '';
  let count = 0;
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    for (const { segment } of segmenter.segment(value)) {
      if (count >= limit) break;
      out += segment;
      count += 1;
    }
  } else {
    out = [...value].slice(0, limit).join('');
  }
  return `${out}…`;
}

export function renderPublishedLifePathText(draft) {
  const normalized = normalizeDraft(draft);
  if (!normalized) return '';
  const lines = [...normalized.nodes]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((node) => {
      const label = node.timeLabel ? `${node.timeLabel} · ` : '';
      return `${label}${node.text}`.trim();
    })
    .filter(Boolean);
  if (normalized.summaryText) {
    lines.push(normalized.summaryText);
  }
  return lines.join('\n').trim();
}

export function validateLifePathDraft(draft) {
  const normalized = normalizeDraft(draft);
  if (!normalized || normalized.nodes.length === 0) {
    return { ok: false, code: 'LIFE_PATH_INVALID_DRAFT', error: '轨迹草稿格式无效' };
  }

  for (const node of normalized.nodes) {
    const len = countGraphemes(node.text);
    if (len < LIFE_PATH_NODE_MIN || len > LIFE_PATH_NODE_MAX) {
      return {
        ok: false,
        code: 'LIFE_PATH_NODE_LENGTH',
        error: `每个节点须为 ${LIFE_PATH_NODE_MIN}～${LIFE_PATH_NODE_MAX} 字，当前有节点不符合`,
      };
    }
    if (!CATEGORY_SET.has(node.category)) {
      return { ok: false, code: 'LIFE_PATH_INVALID_CATEGORY', error: '节点类型无效' };
    }
    const sensitive = findSensitiveSnippet(node.text);
    if (sensitive) {
      return {
        ok: false,
        code: 'LIFE_PATH_SENSITIVE_CONTENT',
        error: '轨迹含有不宜公开的内容，请修改后重试',
      };
    }
  }

  const total = collectVisibleParts(normalized).reduce(
    (sum, part) => sum + countGraphemes(part),
    0
  );
  if (total > LIFE_PATH_TOTAL_MAX) {
    return {
      ok: false,
      code: 'LIFE_PATH_TOO_LONG',
      error: `轨迹全文不能超过 ${LIFE_PATH_TOTAL_MAX} 字`,
    };
  }

  if (normalized.summaryText) {
    const sensitive = findSensitiveSnippet(normalized.summaryText);
    if (sensitive) {
      return {
        ok: false,
        code: 'LIFE_PATH_SENSITIVE_CONTENT',
        error: '轨迹含有不宜公开的内容，请修改后重试',
      };
    }
  }

  return { ok: true, draft: normalized };
}

export function parseLifePathDraftJson(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return normalizeDraft(raw);
  try {
    return normalizeDraft(JSON.parse(String(raw)));
  } catch {
    return null;
  }
}

export function resolvePublishedLifePathForPublic(profileRow, hasPublicEntries) {
  if (!hasPublicEntries) return null;
  if (!profileRow || profileRow.life_path_status !== 'published') return null;
  const text = profileRow.life_path_published_text;
  if (!text || !String(text).trim()) return null;
  return String(text).trim();
}
