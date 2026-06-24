const STORAGE_PREFIX = 'lifeResume.timelineSectionCollapse.v1';

function storageKey(ownerAccountId) {
  return `${STORAGE_PREFIX}:${String(ownerAccountId || '').trim().toUpperCase()}`;
}

export function readTimelineSectionCollapse(ownerAccountId) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(ownerAccountId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

export function writeTimelineSectionCollapse(ownerAccountId, collapsedBySectionId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      storageKey(ownerAccountId),
      JSON.stringify(collapsedBySectionId || {})
    );
  } catch {
    // private mode / quota — ignore
  }
}
