import { entrySeriesStorageKey } from '@shared/utils/lifeResumeEntrySeries.js';

const STORAGE_PREFIX = 'lifeResume.timelineSectionCollapse.v2';

function storageKey(ownerAccountId, entrySeriesId) {
  const owner = String(ownerAccountId || '').trim().toUpperCase();
  const series = entrySeriesStorageKey(entrySeriesId);
  return `${STORAGE_PREFIX}:${owner}:${series}`;
}

export function readTimelineSectionCollapse(ownerAccountId, entrySeriesId = null) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(ownerAccountId, entrySeriesId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

export function writeTimelineSectionCollapse(ownerAccountId, entrySeriesId, collapsedBySectionId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      storageKey(ownerAccountId, entrySeriesId),
      JSON.stringify(collapsedBySectionId || {})
    );
  } catch {
    // private mode / quota — ignore
  }
}
