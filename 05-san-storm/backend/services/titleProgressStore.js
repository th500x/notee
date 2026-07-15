/**
 * player_progress.title_progress JSON 读写（v1）
 *
 * @see docs/00/20-data-layer/25-1-TITLE_SYSTEM.md
 * @see docs/00/00-base/01-database-split/20-tables-player.md §4
 */

const TITLE_PROGRESS_VERSION = 1;

/**
 * @returns {{ v: number, tenureByPositionLevel: object, hasPremium: boolean, tenureLastAccruedDate: string|null }}
 */
function emptyTitleProgress() {
  return {
    v: TITLE_PROGRESS_VERSION,
    tenureByPositionLevel: {},
    hasPremium: false,
    tenureLastAccruedDate: null,
    dailySilverBonusLastDate: null,
  };
}

/**
 * @param {unknown} raw
 */
function normalizeTitleProgress(raw) {
  if (raw == null || raw === '') return emptyTitleProgress();
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return emptyTitleProgress();
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return emptyTitleProgress();
  }
  const tenureRaw = obj.tenureByPositionLevel ?? obj.tenure_by_position_level ?? {};
  const tenureByPositionLevel = {};
  if (tenureRaw && typeof tenureRaw === 'object') {
    for (const [k, v] of Object.entries(tenureRaw)) {
      const n = Number(v);
      if (Number.isFinite(n)) tenureByPositionLevel[String(k)] = Math.max(0, Math.trunc(n));
    }
  }
  const lastDate = obj.tenureLastAccruedDate ?? obj.tenure_last_accrued_date ?? null;
  const dailySilverDate =
    obj.dailySilverBonusLastDate ?? obj.daily_silver_bonus_last_date ?? null;
  return {
    v: Number(obj.v) || TITLE_PROGRESS_VERSION,
    tenureByPositionLevel,
    hasPremium: !!(obj.hasPremium ?? obj.has_premium),
    tenureLastAccruedDate: lastDate ? String(lastDate).slice(0, 10) : null,
    dailySilverBonusLastDate: dailySilverDate ? String(dailySilverDate).slice(0, 10) : null,
  };
}

/**
 * @param {*} connection
 * @param {string} playerId
 */
async function ensureTitleProgressRow(connection, playerId) {
  const pid = String(playerId || '').trim();
  await connection.query('INSERT IGNORE INTO player_progress (player_id) VALUES (?)', [pid]);
}

/**
 * @param {*} connection
 * @param {string} playerId
 */
async function loadTitleProgress(connection, playerId) {
  const pid = String(playerId || '').trim();
  const [rows] = await connection.query(
    'SELECT title_progress FROM player_progress WHERE player_id = ? LIMIT 1',
    [pid],
  );
  return normalizeTitleProgress(rows[0]?.title_progress);
}

/**
 * @param {*} connection
 * @param {string} playerId
 * @param {object} progress
 */
async function saveTitleProgress(connection, playerId, progress) {
  const pid = String(playerId || '').trim();
  const payload = normalizeTitleProgress(progress);
  await connection.query(
    'UPDATE player_progress SET title_progress = ? WHERE player_id = ?',
    [JSON.stringify(payload), pid],
  );
}

module.exports = {
  TITLE_PROGRESS_VERSION,
  emptyTitleProgress,
  normalizeTitleProgress,
  ensureTitleProgressRow,
  loadTitleProgress,
  saveTitleProgress,
};
