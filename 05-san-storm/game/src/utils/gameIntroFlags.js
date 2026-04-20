/**
 * 大地图前特色介绍（gameIntroMessages）仅每位玩家显示一次，持久化在 localStorage。
 */

const LS_PREFIX = 'san_1_game_intro_completed:';

/**
 * @param {string|undefined|null} playerId
 * @returns {boolean}
 */
export function isGameIntroCompletedForPlayer(playerId) {
  if (!playerId || typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(`${LS_PREFIX}${playerId}`) === '1';
  } catch {
    return true;
  }
}

/**
 * @param {string|undefined|null} playerId
 */
export function markGameIntroCompletedForPlayer(playerId) {
  if (!playerId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${LS_PREFIX}${playerId}`, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

/** 创角成功后再进大地图时应重新展示特色介绍（与账号 id 同键） */
export function clearGameIntroCompletionForPlayer(playerId) {
  if (!playerId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${LS_PREFIX}${playerId}`);
  } catch {
    /* ignore */
  }
}
