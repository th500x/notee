/**
 * One pour bag per One Line UUID. Revision CAS so two devices cannot silently clobber.
 */

const { query } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const { parseBody, publicBag } = require('../lib/pourBagRules');
const { requireActiveUser } = require('./userService');

async function getBag(userId) {
  await requireActiveUser(userId);
  const rows = await query(`SELECT * FROM pour_bags WHERE user_id = ? LIMIT 1`, [userId]);
  return publicBag(rows[0] || null);
}

async function putBag(userId, body) {
  await requireActiveUser(userId);
  const bag = parseBody(body);
  const rows = await query(`SELECT revision FROM pour_bags WHERE user_id = ? LIMIT 1`, [userId]);
  const current = rows[0] ? Number(rows[0].revision) : 0;
  if (current >= bag.revision) {
    const err = httpError(409, '袋已在其他设备更新，请先拉取', 'POUR_BAG_STALE');
    err.bag = await getBag(userId);
    throw err;
  }
  try {
    if (!rows.length) {
      await query(
        `INSERT INTO pour_bags
          (user_id, ledger_blob, history_blob, keep_last_30, revision)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          bag.ledgerBlob,
          bag.historyBlob,
          bag.keepLast30 ? 1 : 0,
          bag.revision,
        ]
      );
    } else {
      const result = await query(
        `UPDATE pour_bags
         SET ledger_blob = ?, history_blob = ?, keep_last_30 = ?, revision = ?
         WHERE user_id = ? AND revision < ?`,
        [
          bag.ledgerBlob,
          bag.historyBlob,
          bag.keepLast30 ? 1 : 0,
          bag.revision,
          userId,
          bag.revision,
        ]
      );
      if (!result.affectedRows) {
        const err = httpError(409, '袋已在其他设备更新，请先拉取', 'POUR_BAG_STALE');
        err.bag = await getBag(userId);
        throw err;
      }
    }
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      const stale = httpError(409, '袋已在其他设备更新，请先拉取', 'POUR_BAG_STALE');
      stale.bag = await getBag(userId);
      throw stale;
    }
    throw err;
  }
  return publicBag({
    ledger_blob: bag.ledgerBlob,
    history_blob: bag.historyBlob,
    keep_last_30: bag.keepLast30 ? 1 : 0,
    revision: bag.revision,
  });
}

async function deleteBag(userId) {
  await query(`DELETE FROM pour_bags WHERE user_id = ?`, [userId]);
}

module.exports = { getBag, putBag, deleteBag };
