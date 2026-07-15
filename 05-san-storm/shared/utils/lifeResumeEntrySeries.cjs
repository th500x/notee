/**
 * 11-life-resume 人生片段系列（entrySeries）
 * 须与 lifeResumeEntrySeries.js 同步
 */

const CHRONOLOGICAL_ENTRY_SERIES_ID = null;
const CHRONOLOGICAL_ENTRY_SERIES_KEY = 'chronological';
const CHRONOLOGICAL_ENTRY_SERIES_NAME = '编年历';
const MAX_CUSTOM_ENTRY_SERIES_PER_USER = 2;
const ENTRY_SERIES_NAME_MAX_CJK = 5;

function normalizeEntrySeriesId(raw) {
  if (raw == null || raw === '' || raw === CHRONOLOGICAL_ENTRY_SERIES_KEY) {
    return null;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return NaN;
  }
  return n;
}

function entrySeriesStorageKey(entrySeriesId) {
  if (entrySeriesId == null) return CHRONOLOGICAL_ENTRY_SERIES_KEY;
  return String(entrySeriesId);
}

function validateEntrySeriesName(name) {
  const text = String(name ?? '').trim();
  if (!text) {
    return { ok: false, error: '请填写系列名称', code: 'INVALID_ENTRY_SERIES_NAME' };
  }
  if (text === CHRONOLOGICAL_ENTRY_SERIES_NAME) {
    return {
      ok: false,
      error: `「${CHRONOLOGICAL_ENTRY_SERIES_NAME}」为内置系列名，请换一个名称`,
      code: 'INVALID_ENTRY_SERIES_NAME',
    };
  }
  const han = text.match(/\p{Script=Han}/gu) || [];
  if (han.length !== [...text].length) {
    return { ok: false, error: '系列名称仅支持中文汉字', code: 'INVALID_ENTRY_SERIES_NAME' };
  }
  if (han.length > ENTRY_SERIES_NAME_MAX_CJK) {
    return {
      ok: false,
      error: `系列名称最多 ${ENTRY_SERIES_NAME_MAX_CJK} 个汉字`,
      code: 'INVALID_ENTRY_SERIES_NAME',
    };
  }
  return { ok: true, name: text };
}

function filterEntriesByEntrySeriesId(entries, entrySeriesId) {
  const target = entrySeriesId == null ? null : Number(entrySeriesId);
  return (entries || []).filter((entry) => {
    const id = entry.entrySeriesId ?? null;
    if (target == null) return id == null;
    return Number(id) === target;
  });
}

function buildEntrySeriesSwitcherList(customSeries = []) {
  const custom = [...(customSeries || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id
  );
  return [
    {
      id: CHRONOLOGICAL_ENTRY_SERIES_ID,
      key: CHRONOLOGICAL_ENTRY_SERIES_KEY,
      name: CHRONOLOGICAL_ENTRY_SERIES_NAME,
      isBuiltin: true,
    },
    ...custom.map((row) => ({
      id: Number(row.id),
      key: String(row.id),
      name: row.name,
      isBuiltin: false,
    })),
  ];
}

function buildVisibleEntrySeriesList(visibleEntries, customSeries, isOwner) {
  if (isOwner) {
    return buildEntrySeriesSwitcherList(customSeries);
  }
  const usedIds = new Set();
  for (const entry of visibleEntries || []) {
    const sid = entry.entrySeriesId ?? null;
    if (sid != null) usedIds.add(Number(sid));
  }
  const filteredCustom = (customSeries || []).filter((row) => usedIds.has(Number(row.id)));
  return buildEntrySeriesSwitcherList(filteredCustom);
}

module.exports = {
  CHRONOLOGICAL_ENTRY_SERIES_ID,
  CHRONOLOGICAL_ENTRY_SERIES_KEY,
  CHRONOLOGICAL_ENTRY_SERIES_NAME,
  MAX_CUSTOM_ENTRY_SERIES_PER_USER,
  ENTRY_SERIES_NAME_MAX_CJK,
  normalizeEntrySeriesId,
  entrySeriesStorageKey,
  validateEntrySeriesName,
  filterEntriesByEntrySeriesId,
  buildEntrySeriesSwitcherList,
  buildVisibleEntrySeriesList,
};
