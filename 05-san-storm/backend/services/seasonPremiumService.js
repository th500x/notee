/**
 * 赛季战令开通（accounts.hasPremium + title_progress 镜像）
 *
 * @see docs/00-base/01-database-split/10-tables-account.md §1.1
 * @see docs/20-data-layer/25-1-TITLE_SYSTEM.md · 荣耀战令
 */

const { pool } = require('../database/connection');
const {
  ensureTitleProgressRow,
  loadTitleProgress,
  saveTitleProgress,
} = require('./titleProgressStore');
const { runPlayerMilestoneCheckSafe } = require('./milestoneHookHelper');

const DEV_TEST_CODE = 'DEV_SEASON_PREMIUM';

function parseActivationCodesFromEnv() {
  const raw = process.env.SEASON_PREMIUM_ACTIVATION_CODES || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} code
 * @returns {boolean}
 */
function isValidActivationCode(code) {
  const trimmed = String(code || '').trim();
  if (!trimmed) return false;
  const allowed = parseActivationCodesFromEnv();
  if (allowed.includes(trimmed)) return true;
  if (process.env.NODE_ENV !== 'production' && trimmed === DEV_TEST_CODE) return true;
  return false;
}

/**
 * @param {*} connection
 * @param {string} playerId
 */
async function syncPremiumFlagToTitleProgress(connection, playerId, hasPremium) {
  const pid = String(playerId || '').trim();
  await ensureTitleProgressRow(connection, pid);
  const progress = await loadTitleProgress(connection, pid);
  progress.hasPremium = !!hasPremium;
  await saveTitleProgress(connection, pid, progress);
}

/**
 * @param {string} playerId
 * @returns {Promise<{ ok: true, alreadyActive: boolean, milestone: object|null } | { ok: false, status: number, error: string }>}
 */
async function activateSeasonPremium(playerId, activationCode) {
  const pid = String(playerId || '').trim();
  if (!pid) {
    return { ok: false, status: 400, error: '玩家 ID 无效' };
  }
  if (!isValidActivationCode(activationCode)) {
    return { ok: false, status: 400, error: '激活码无效' };
  }

  const [accountRows] = await pool.query(
    'SELECT hasPremium FROM accounts WHERE id = ? LIMIT 1',
    [pid],
  );
  if (!accountRows.length) {
    return { ok: false, status: 404, error: '账号不存在' };
  }
  if (accountRows[0].hasPremium) {
    const milestone = await runPlayerMilestoneCheckSafe(pid, 'premium_already_active');
    return { ok: true, alreadyActive: true, milestone };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('UPDATE accounts SET hasPremium = TRUE WHERE id = ?', [pid]);
    await syncPremiumFlagToTitleProgress(connection, pid, true);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    console.error('[seasonPremium] activate failed', err);
    return { ok: false, status: 500, error: '战令开通失败' };
  } finally {
    connection.release();
  }

  const milestone = await runPlayerMilestoneCheckSafe(pid, 'premium_activate');
  console.log(`[seasonPremium] activated player=${pid}`);
  return { ok: true, alreadyActive: false, milestone };
}

/**
 * 登录后：账号已开通战令则同步 JSON 并补检称号（幂等）
 *
 * @param {string} playerId
 */
async function reconcilePremiumOnLogin(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return;
  const [rows] = await pool.query('SELECT hasPremium FROM accounts WHERE id = ? LIMIT 1', [pid]);
  if (!rows[0]?.hasPremium) return;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await syncPremiumFlagToTitleProgress(connection, pid, true);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    console.warn('[seasonPremium] reconcile on login failed', pid, err?.message || err);
    return;
  } finally {
    connection.release();
  }
  await runPlayerMilestoneCheckSafe(pid, 'premium_login_reconcile');
}

module.exports = {
  activateSeasonPremium,
  reconcilePremiumOnLogin,
  isValidActivationCode,
  DEV_TEST_CODE,
};
