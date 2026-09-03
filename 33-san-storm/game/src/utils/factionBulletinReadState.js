/**
 * 势力 Tab · 公告已读水位（localStorage，按 player_id）
 * 用于底栏「势力」Tab 新公告红点：仅当最新公告 id 高于已读水位时提示。
 */

const LS_PREFIX = 'san_1_faction_bulletin_last_seen_id:';

/** @type {Set<() => void>} */
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/**
 * @param {string|undefined|null} playerId
 * @returns {number|null} null = 尚未建立基线（首次进入游戏）
 */
export function getLastSeenFactionBulletinId(playerId) {
  if (!playerId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${LS_PREFIX}${playerId}`);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  } catch {
    return null;
  }
}

/**
 * @param {{ edicts?: Array<{ id?: number }>, documents?: Array<{ id?: number }>, wars?: Array<{ id?: number }> }|null|undefined} grouped
 * @returns {number}
 */
export function computeMaxFactionBulletinId(grouped) {
  if (!grouped || typeof grouped !== 'object') return 0;
  const all = [...(grouped.edicts || []), ...(grouped.documents || []), ...(grouped.wars || [])];
  return all.reduce((max, row) => Math.max(max, Number(row?.id) || 0), 0);
}

/**
 * @param {string|undefined|null} playerId
 * @param {number} maxId
 */
export function markFactionBulletinsSeenUpTo(playerId, maxId) {
  if (!playerId || typeof window === 'undefined') return;
  const id = Math.max(0, Math.floor(Number(maxId) || 0));
  try {
    const prev = getLastSeenFactionBulletinId(playerId);
    const next = prev === null ? id : Math.max(prev, id);
    window.localStorage.setItem(`${LS_PREFIX}${playerId}`, String(next));
    notify();
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @param {string|undefined|null} playerId
 * @param {{ edicts?: Array<{ id?: number }>, documents?: Array<{ id?: number }>, wars?: Array<{ id?: number }> }|null|undefined} grouped
 * @returns {boolean}
 */
export function hasUnreadFactionBulletins(playerId, grouped) {
  if (!playerId) return false;
  const maxId = computeMaxFactionBulletinId(grouped);
  const lastSeen = getLastSeenFactionBulletinId(playerId);
  if (lastSeen === null) return false;
  return maxId > lastSeen;
}

/** @param {() => void} fn */
export function subscribeFactionBulletinReadState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 公告流水变更后通知底栏红点轮询（如三公府发布文书） */
export function notifyFactionBulletinUnread() {
  notify();
}
