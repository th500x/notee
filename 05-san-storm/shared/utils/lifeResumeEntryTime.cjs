/**
 * 11-life-resume 条目时间与 timeline_sort_key
 * 须与 lifeResumeEntryTime.js 同步
 */

const LIFE_STAGE_UNKNOWN = 'unknown';

const LIFE_STAGE_CODES = [LIFE_STAGE_UNKNOWN];

const LIFE_STAGE_LABELS = {
  unknown: '未知',
};

const LIFE_STAGE_SORT_KEY_UNKNOWN = 900001;

function computeTimelineSortKey(fields) {
  const { year, lifeStage, month, day } = fields;
  if (year != null) {
    const y = Number(year);
    const m = month != null ? Number(month) : null;
    const d = day != null ? Number(day) : null;
    if (m != null && d != null) {
      return y * 10000 + m * 100 + d;
    }
    if (m != null) {
      return y * 10000 + m * 100 + 1;
    }
    return y * 10000 + 101;
  }
  if (lifeStage === LIFE_STAGE_UNKNOWN) {
    return LIFE_STAGE_SORT_KEY_UNKNOWN;
  }
  throw new Error('missing year or unknown lifeStage for sort key');
}

function validateEntryTimeFields(input) {
  const year = input.year != null && input.year !== '' ? Number(input.year) : null;
  const lifeStage =
    input.lifeStage != null && input.lifeStage !== '' ? String(input.lifeStage).trim() : null;
  const month = input.month != null && input.month !== '' ? Number(input.month) : null;
  const day = input.day != null && input.day !== '' ? Number(input.day) : null;

  const hasYear = year != null && !Number.isNaN(year);
  const hasUnknown = lifeStage === LIFE_STAGE_UNKNOWN;

  if (hasYear && hasUnknown) {
    return { ok: false, error: '年份与未知只能二选一', code: 'INVALID_TIME' };
  }
  if (!hasYear && !hasUnknown) {
    return { ok: false, error: '请填写年份或选择未知', code: 'INVALID_TIME' };
  }

  if (hasYear) {
    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      return { ok: false, error: '年份须为 1–9999 的整数', code: 'INVALID_TIME' };
    }
    if (month != null) {
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return { ok: false, error: '月份须为 1–12', code: 'INVALID_TIME' };
      }
    }
    if (day != null) {
      if (month == null) {
        return { ok: false, error: '填写日期前须先填写月份', code: 'INVALID_TIME' };
      }
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return { ok: false, error: '日期须为 1–31', code: 'INVALID_TIME' };
      }
    }
    return {
      ok: true,
      year,
      lifeStage: null,
      month: month ?? null,
      day: day ?? null,
      timelineSortKey: computeTimelineSortKey({ year, lifeStage: null, month, day }),
    };
  }

  if (month != null || day != null) {
    return { ok: false, error: '未知时间条目不能填写月日', code: 'INVALID_TIME' };
  }

  return {
    ok: true,
    year: null,
    lifeStage: LIFE_STAGE_UNKNOWN,
    month: null,
    day: null,
    timelineSortKey: computeTimelineSortKey({ year: null, lifeStage: LIFE_STAGE_UNKNOWN }),
  };
}

function formatLifeStageLabel(code) {
  if (code === LIFE_STAGE_UNKNOWN) return LIFE_STAGE_LABELS.unknown;
  return '';
}

function formatEntryTimeLabel(fields) {
  if (fields.year != null) {
    let label = `${fields.year} 年`;
    if (fields.month != null) {
      label += ` ${fields.month} 月`;
      if (fields.day != null) {
        label += `${fields.day} 日`;
      }
    }
    return label;
  }
  if (fields.lifeStage === LIFE_STAGE_UNKNOWN) {
    return LIFE_STAGE_LABELS.unknown;
  }
  return '';
}

function groupTimelineSections(entries) {
  const sections = new Map();

  for (const entry of entries || []) {
    const sortKey = Number(entry.timelineSortKey) || 0;
    let sectionId;
    let label;
    let type;

    if (entry.year != null) {
      type = 'year';
      sectionId = `year:${entry.year}`;
      label = String(entry.year);
    } else {
      type = 'unknown';
      sectionId = 'unknown';
      label = LIFE_STAGE_LABELS.unknown;
    }

    if (!sections.has(sectionId)) {
      sections.set(sectionId, {
        id: sectionId,
        type,
        label,
        sortKey,
        entries: [],
      });
    }

    const section = sections.get(sectionId);
    section.sortKey = Math.min(section.sortKey, sortKey);
    section.entries.push(entry);
  }

  return [...sections.values()]
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((section) => ({
      ...section,
      entries: [...section.entries].sort(
        (a, b) => (a.timelineSortKey || 0) - (b.timelineSortKey || 0) || a.id - b.id
      ),
    }));
}

function compareEntryTimelineOrder(a, b) {
  return (a.timelineSortKey || 0) - (b.timelineSortKey || 0) || a.id - b.id;
}

function buildTimelineLayoutWithPinned(entries) {
  const all = entries || [];
  const pinned = all.filter((entry) => entry.isPinned).sort(compareEntryTimelineOrder);
  const rest = all.filter((entry) => !entry.isPinned);
  return {
    pinned,
    sections: groupTimelineSections(rest),
  };
}

module.exports = {
  LIFE_STAGE_UNKNOWN,
  LIFE_STAGE_CODES,
  LIFE_STAGE_LABELS,
  computeTimelineSortKey,
  validateEntryTimeFields,
  formatLifeStageLabel,
  formatEntryTimeLabel,
  groupTimelineSections,
  buildTimelineLayoutWithPinned,
};
