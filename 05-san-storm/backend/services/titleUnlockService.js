/**
 * 称号 unlock_conditions 自动解锁（达标发卡，无进度条）
 *
 * @see docs/00/20-data-layer/25-1-TITLE_SYSTEM.md §6、§10
 */

const { evaluateUnlockCondition } = require('../../shared/utils/unlockConditionEvaluator.js');
const { grantUniqueTitleOrAchievementCard } = require('./uniqueCardGrantService');

/**
 * @param {*} connection
 * @param {string} playerId
 * @param {object} snapshot
 * @returns {Promise<{ newlyGranted: object[], discarded: object[], skipped: object[] }>}
 */
async function tryUnlockTitles(playerId, snapshot, connection) {
  const pid = String(playerId || '').trim();
  const result = { newlyGranted: [], discarded: [], skipped: [] };

  const [configRows] = await connection.query(
    `SELECT title_id, title_name, unlock_conditions
     FROM config_titles
     WHERE unlock_conditions IS NOT NULL AND unlock_conditions != ''
     ORDER BY title_id`,
  );

  const [ownedRows] = await connection.query(
    `SELECT DISTINCT card_id AS title_id
     FROM player_cards
     WHERE player_id = ? AND card_type = 'title'`,
    [pid],
  );
  const ownedSet = new Set(ownedRows.map((r) => r.title_id));

  for (const row of configRows) {
    const titleId = row.title_id;
    if (ownedSet.has(titleId)) continue;

    const evalResult = evaluateUnlockCondition(row.unlock_conditions, snapshot, { kind: 'title' });
    if (!evalResult.ok) {
      if (evalResult.reason && !evalResult.reason.startsWith('BELOW_THRESHOLD')
        && !evalResult.reason.startsWith('EVENT_NOT_COMPLETED')
        && !evalResult.reason.startsWith('TENURE_INSUFFICIENT')
        && evalResult.reason !== 'PREMIUM_NOT_ACTIVE') {
        console.warn(`[titleUnlock] ${titleId}: ${evalResult.reason}`);
      }
      continue;
    }

    const details = [];
    const grant = await grantUniqueTitleOrAchievementCard(connection, {
      playerId: pid,
      cardId: titleId,
      details,
    });
    if (grant.granted) {
      ownedSet.add(titleId);
      result.newlyGranted.push({
        titleId,
        titleName: grant.cardName || row.title_name || titleId,
        instanceId: grant.instanceId,
      });
    } else if (grant.discarded) {
      result.discarded.push({ titleId, titleName: grant.cardName || row.title_name || titleId });
    }
  }

  return result;
}

module.exports = {
  tryUnlockTitles,
};
