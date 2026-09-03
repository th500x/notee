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

/** 离屏 30s 自动结算后、用户确认前若杀进程：重进时续接 endBattle */
export function exploreAwayBattleEndStorageKey(pendingKey) {
  return pendingKey ? `${pendingKey}_away_battle_end` : null;
}

export function clearExploreAwayBattleEndLocal(pendingKey) {
  const k = exploreAwayBattleEndStorageKey(pendingKey);
  if (!k) return;
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** 与大地图探索、战场入口、教程链共用的配置池 trigger_context（14-1：tutorial / wild / mini） */
export const EXPLORE_RELATED_TRIGGER_CONTEXTS = ['tutorial', 'wild', 'mini'];
