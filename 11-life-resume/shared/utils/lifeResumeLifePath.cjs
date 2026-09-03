/**
 * 11-life-resume · lifePath（人生轨迹）校验与渲染
 * 须与 lifeResumeLifePath.js 同步
 */

const { countGraphemes } = require('./lifeResumeGraphemeCount.cjs');

const LIFE_PATH_TOTAL_MAX = 500;
const LIFE_PATH_NODE_MIN = 20;
const LIFE_PATH_NODE_MAX = 50;
const DEFAULT_LIFE_PATH_COOLDOWN_HOURS = 24;

const LIFE_PATH_CATEGORIES = [
  'location',
  'family',
  'work',
  'relationship',
  'study',
  'other',
];

const CATEGORY_SET = new Set(LIFE_PATH_CATEGORIES);

/** 通义常返回中文或别名，归一化为英文枚举 */
const LIFE_PATH_CATEGORY_ALIAS_TO_CANONICAL = {
  location: ['location', 'loc', 'place', 'move', '所在地', '地点', '位置', '迁居', '搬迁', '城市'],
  family: ['family', '家庭', '家人', '亲属'],
  work: ['work', 'job', 'career', 'office', '工作', '职业', '职场', '事业'],
  relationship: ['relationship', 'relation', 'love', '人际关系', '关系', '感情', '社交', '朋友'],
  study: ['study', 'education', 'school', 'university', '学业', '学习', '教育', '读书'],
  other: ['other', 'misc', 'general', 'life', 'travel', 'trip', 'milestone', '人生', '游记', '旅行', '其他'],
};

function normalizeLifePathCategory(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return 'other';
  if (CATEGORY_SET.has(value)) return value;
  const lower = value.toLowerCase();
  if (CATEGORY_SET.has(lower)) return lower;

  for (const [canonical, aliases] of Object.entries(LIFE_PATH_CATEGORY_ALIAS_TO_CANONICAL)) {
    if (aliases.some((alias) => alias === value || alias.toLowerCase() === lower)) {
      return canonical;
    }
  }

  if (/学|读|校|院/.test(value)) return 'study';
  if (/工|职|业|岗/.test(value)) return 'work';
  if (/家|亲/.test(value)) return 'family';
  if (/地|城|迁|居|旅|游/.test(value)) return value.includes('游') || value.includes('旅') ? 'other' : 'location';
  if (/关系|友|恋|婚/.test(value)) return 'relationship';

  return 'other';
}

const LIFE_PATH_CATEGORY_LABELS = {
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

/** 送入通义前替换易触发输入审核的词（不改变用户原文入库） */
const AI_INPUT_REDACT_PATTERNS = [
  /犯罪/g,
  /被捕/g,
  /坐牢/g,
  /判刑/g,
  /猥亵/g,
  /强奸/g,
  /吸毒/g,
  /贩毒/g,
  /血腥/g,
  /暴力/g,
  /自杀/g,
  /自残/g,
  /赌博/g,
  /色情/g,
  /裸体/g,
];

const LIFE_PATH_AI_INPUT_MODES = ['standard', 'public_only', 'metadata_only'];

function normalizeDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : null;
  if (!nodes) return null;
  return {
    nodes: nodes.map((node, index) => ({
      sortOrder: Number(node?.sortOrder ?? index + 1),
      timeLabel: String(node?.timeLabel ?? '').trim(),
      category: normalizeLifePathCategory(node?.category),
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

function sanitizeLifePathAiText(text) {
  let value = String(text ?? '');
  for (const pattern of AI_INPUT_REDACT_PATTERNS) {
    value = value.replace(pattern, '（略）');
  }
  return value.trim();
}

function buildLifePathAiEntrySnapshot(entry, { bodyMaxChars, inputMode = 'standard' }) {
  const base = {
    entryId: entry.id,
    publishStatus: entry.status,
    visibility: entry.visibility,
    year: entry.year,
    month: entry.month,
    day: entry.day,
    lifeStage: entry.lifeStage,
    tags: entry.tags || [],
    locationPublicLabel: entry.locationPublicLabel || null,
    title: entry.title ? sanitizeLifePathAiText(entry.title) : null,
  };

  if (inputMode === 'metadata_only') {
    return { ...base, body: null, contentOmitted: 'metadata_only' };
  }

  const isPublicPublished = entry.status === 'published' && entry.visibility === 'public';
  if (inputMode === 'standard' && !isPublicPublished) {
    return { ...base, body: null, contentOmitted: 'non_public_entry' };
  }

  return {
    ...base,
    body: sanitizeLifePathAiText(truncateTextForLifePathPrompt(entry.body, bodyMaxChars)),
  };
}

function filterEntriesForLifePathInputMode(entries, inputMode) {
  const list = Array.isArray(entries) ? entries : [];
  if (inputMode === 'public_only') {
    return list.filter((entry) => entry.status === 'published' && entry.visibility === 'public');
  }
  return list;
}

function truncateTextForLifePathPrompt(text, maxChars) {
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

function stripRedundantTimeLabelFromText(timeLabel, text) {
  let value = String(text ?? '').trim();
  const label = String(timeLabel ?? '').trim();
  if (!value || !label) return value;

  if (value.startsWith(label)) {
    value = value.slice(label.length).replace(/^[，,、·\s]+/, '');
  }

  const yearMatch = label.match(/^(\d{4})/);
  if (yearMatch) {
    const year = yearMatch[1];
    const yearPrefix = new RegExp(`^${year}年?[，,、·\\s]*`);
    if (yearPrefix.test(value)) {
      value = value.replace(yearPrefix, '');
    }
  }

  return value.trim();
}

function formatLifePathNodeLine(node) {
  const timeLabel = String(node?.timeLabel ?? '').trim();
  const text = stripRedundantTimeLabelFromText(timeLabel, String(node?.text ?? '').trim());
  if (!timeLabel) return text;
  if (!text) return timeLabel;
  return `${timeLabel} · ${text}`;
}

function formatPublishedLifePathDisplayText(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => {
      const value = String(line ?? '').trim();
      if (!value) return '';
      const parts = value.split(/\s*[·・]\s*/);
      if (parts.length < 2) return value;
      const timeLabel = parts[0].trim();
      const body = parts.slice(1).join(' · ').trim();
      return formatLifePathNodeLine({ timeLabel, text: body });
    })
    .filter(Boolean)
    .join('\n');
}

function renderPublishedLifePathText(draft) {
  const normalized = normalizeDraft(draft);
  if (!normalized) return '';
  const lines = [...normalized.nodes]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((node) => formatLifePathNodeLine(node))
    .filter(Boolean);
  if (normalized.summaryText) {
    lines.push(normalized.summaryText);
  }
  return lines.join('\n').trim();
}

function trimToMaxGraphemes(text, maxChars) {
  const limit = Math.max(1, Number(maxChars) || LIFE_PATH_NODE_MAX);
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
  return out;
}

function repairLifePathNodeText(node) {
  let text = String(node.text || '').trim();
  if (!text) return text;

  const timeLabel = String(node.timeLabel || '').trim();
  const categoryLabel = LIFE_PATH_CATEGORY_LABELS[node.category] || '人生';

  if (countGraphemes(text) < LIFE_PATH_NODE_MIN && timeLabel) {
    const stripped = stripRedundantTimeLabelFromText(timeLabel, text);
    if (stripped !== text) {
      text = stripped;
    }
    if (countGraphemes(text) < LIFE_PATH_NODE_MIN) {
      const again = stripRedundantTimeLabelFromText(timeLabel, text);
      if (again === text) {
        text = `${timeLabel}，${text}`;
      }
    }
  }
  if (countGraphemes(text) < LIFE_PATH_NODE_MIN) {
    text = `${text}（${categoryLabel}相关）`;
  }
  if (countGraphemes(text) < LIFE_PATH_NODE_MIN) {
    text = `${text}，见于本人人生片段时间轴`;
  }

  return trimToMaxGraphemes(text, LIFE_PATH_NODE_MAX);
}

function repairLifePathDraft(draft) {
  const normalized = normalizeDraft(draft);
  if (!normalized) return null;
  return {
    ...normalized,
    nodes: normalized.nodes.map((node) => ({
      ...node,
      text: repairLifePathNodeText(node),
    })),
  };
}

function validateLifePathDraft(draft) {
  const normalized = repairLifePathDraft(draft) || normalizeDraft(draft);
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

function parseLifePathDraftJson(raw) {
  return normalizeLifePathDraftEnvelope(raw);
}

const LIFE_PATH_STYLE_VARIANTS = ['factual', 'expressive'];
const LIFE_PATH_DEFAULT_STYLE_VARIANT = 'factual';

const LIFE_PATH_STYLE_LABELS = {
  factual: '平实记述',
  expressive: '生动表述',
};

function parseStoredLifePathDraft(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function normalizeLifePathDraftEnvelope(raw) {
  const parsed = parseStoredLifePathDraft(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  if (parsed.variants && typeof parsed.variants === 'object') {
    const variants = {};
    for (const key of LIFE_PATH_STYLE_VARIANTS) {
      const draft = parsed.variants[key] ? normalizeDraft(parsed.variants[key]) : null;
      if (draft) variants[key] = draft;
    }
    if (!variants.factual && !variants.expressive) return null;
    let selectedVariant = LIFE_PATH_STYLE_VARIANTS.includes(parsed.selectedVariant)
      ? parsed.selectedVariant
      : LIFE_PATH_DEFAULT_STYLE_VARIANT;
    if (!variants[selectedVariant]) {
      selectedVariant = variants.factual ? 'factual' : 'expressive';
    }
    return {
      version: 2,
      variants,
      selectedVariant,
      sourceEntryIds: Array.isArray(parsed.sourceEntryIds)
        ? parsed.sourceEntryIds.map((id) => String(id))
        : [],
      model: parsed.model != null ? String(parsed.model) : null,
      generatedAt: parsed.generatedAt != null ? String(parsed.generatedAt) : null,
    };
  }

  const legacy = normalizeDraft(parsed);
  if (!legacy) return null;
  return {
    version: 2,
    variants: { factual: legacy },
    selectedVariant: LIFE_PATH_DEFAULT_STYLE_VARIANT,
    sourceEntryIds: legacy.sourceEntryIds || [],
    model: legacy.model || null,
    generatedAt: legacy.generatedAt || null,
  };
}

function getLifePathDraftVariant(envelope, variantKey = LIFE_PATH_DEFAULT_STYLE_VARIANT) {
  if (!envelope?.variants) return null;
  const key = LIFE_PATH_STYLE_VARIANTS.includes(variantKey) ? variantKey : envelope.selectedVariant;
  return envelope.variants[key] || null;
}

function listAvailableLifePathVariants(envelope) {
  if (!envelope?.variants) return [];
  return LIFE_PATH_STYLE_VARIANTS.filter((key) => envelope.variants[key]?.nodes?.length);
}

function buildLifePathDraftEnvelope({ variants, sourceEntryIds, model, generatedAt, selectedVariant }) {
  return {
    version: 2,
    variants,
    selectedVariant: LIFE_PATH_STYLE_VARIANTS.includes(selectedVariant)
      ? selectedVariant
      : LIFE_PATH_DEFAULT_STYLE_VARIANT,
    sourceEntryIds: Array.isArray(sourceEntryIds) ? sourceEntryIds.map((id) => String(id)) : [],
    model: model != null ? String(model) : null,
    generatedAt: generatedAt || new Date().toISOString(),
  };
}

function resolvePublishedLifePathForPublic(profileRow, hasPublicEntries) {
  if (!hasPublicEntries) return null;
  if (!profileRow || profileRow.life_path_status !== 'published') return null;
  const text = profileRow.life_path_published_text;
  if (!text || !String(text).trim()) return null;
  return String(text).trim();
}

function assessLifePathGenerateCooldown(
  generatedAt,
  cooldownHours = DEFAULT_LIFE_PATH_COOLDOWN_HOURS,
  now = new Date()
) {
  if (!generatedAt) {
    return { ok: true, availableAt: null, remainingMs: 0 };
  }
  const last = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  if (Number.isNaN(last.getTime())) {
    return { ok: true, availableAt: null, remainingMs: 0 };
  }
  const cooldownMs = Math.max(1, Number(cooldownHours) || DEFAULT_LIFE_PATH_COOLDOWN_HOURS) * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - last.getTime();
  if (elapsedMs >= cooldownMs) {
    return { ok: true, availableAt: null, remainingMs: 0 };
  }
  const remainingMs = cooldownMs - elapsedMs;
  return {
    ok: false,
    availableAt: new Date(last.getTime() + cooldownMs),
    remainingMs,
  };
}

function formatLifePathCooldownRemaining(remainingMs) {
  const ms = Math.max(0, Number(remainingMs) || 0);
  if (ms <= 0) return '可以生成';
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `约 ${hours} 小时后可再生成`;
    return `约 ${hours} 小时 ${minutes} 分钟后可再生成`;
  }
  return `约 ${totalMinutes} 分钟后可再生成`;
}

module.exports = {
  LIFE_PATH_TOTAL_MAX,
  LIFE_PATH_NODE_MIN,
  LIFE_PATH_NODE_MAX,
  DEFAULT_LIFE_PATH_COOLDOWN_HOURS,
  LIFE_PATH_CATEGORIES,
  LIFE_PATH_CATEGORY_LABELS,
  LIFE_PATH_AI_INPUT_MODES,
  LIFE_PATH_STYLE_VARIANTS,
  LIFE_PATH_DEFAULT_STYLE_VARIANT,
  LIFE_PATH_STYLE_LABELS,
  sanitizeLifePathAiText,
  buildLifePathAiEntrySnapshot,
  filterEntriesForLifePathInputMode,
  normalizeLifePathCategory,
  stripRedundantTimeLabelFromText,
  formatLifePathNodeLine,
  formatPublishedLifePathDisplayText,
  repairLifePathDraft,
  truncateTextForLifePathPrompt,
  renderPublishedLifePathText,
  validateLifePathDraft,
  parseLifePathDraftJson,
  normalizeLifePathDraftEnvelope,
  getLifePathDraftVariant,
  listAvailableLifePathVariants,
  buildLifePathDraftEnvelope,
  resolvePublishedLifePathForPublic,
  assessLifePathGenerateCooldown,
  formatLifePathCooldownRemaining,
};
