/** 大地图探索 localStorage / sessionStorage 键（原 useEventSystem.js） */

export function pendingMapEventHintStorageKey(playerId) {
  const id = playerId != null ? String(playerId).trim() : '';
  return id ? `pending_map_event_hint_${id}` : null;
}

/** 与 `pending_event_${playerId}` 并列：存 phase / chosenOption / fortune，供 F5 后恢复荒郊等探索子流程。 */
export function exploreResumeStorageKey(pendingKey) {
  return pendingKey ? `${pendingKey}_resume` : null;
}

export function clearExploreResumeLocal(pendingKey) {
  const rk = exploreResumeStorageKey(pendingKey);
  if (!rk) return;
  try {
    localStorage.removeItem(rk);
  } catch {
    /* ignore */
  }
}

/** 与大地图探索、荒郊/集市内嵌条、匪寨格共用的配置池 trigger_context */
export const EXPLORE_RELATED_TRIGGER_CONTEXTS = [
  'explore',
  'wilderness',
  'market',
  'mystery',
  'tutorial',
];
