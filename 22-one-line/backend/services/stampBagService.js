/**
 * One stamp bag per One Line UUID. Revision CAS so two devices cannot silently clobber.
 */

const { query } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const { parseBody, publicBag } = require('../lib/stampBagRules');
const { requireActiveUser } = require('./userService');

async function getBag(userId) {
  await requireActiveUser(userId);
  const rows = await query(`SELECT * FROM stamp_bags WHERE user_id = ? LIMIT 1`, [userId]);
  return publicBag(rows[0] || null);
}

async function putBag(userId, body) {
  await requireActiveUser(userId);
  const bag = parseBody(body);
  const rows = await query(`SELECT revision FROM stamp_bags WHERE user_id = ? LIMIT 1`, [userId]);
  const current = rows[0] ? Number(rows[0].revision) : 0;
  if (current >= bag.revision) {
    const err = httpError(409, '袋已在其他设备更新，请先拉取', 'STAMP_BAG_STALE');
    err.bag = await getBag(userId);
    throw err;
  }
  try {
    if (!rows.length) {
      await query(
        `INSERT INTO stamp_bags
          (user_id, inventory_blob, check_in_blob, welcome_picked, gift_claimed_ids, revision)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          bag.inventoryBlob,
          bag.checkInBlob,
          bag.welcomePicked ? 1 : 0,
          bag.giftClaimedIds || null,
          bag.revision,
        ]
      );
    } else {
      const result = await query(
        `UPDATE stamp_bags
         SET inventory_blob = ?, check_in_blob = ?, welcome_picked = ?, gift_claimed_ids = ?, revision = ?
         WHERE user_id = ? AND revision < ?`,
        [
          bag.inventoryBlob,
          bag.checkInBlob,
          bag.welcomePicked ? 1 : 0,
          bag.giftClaimedIds || null,
          bag.revision,
          userId,
          bag.revision,
        ]
      );
      if (!result.affectedRows) {
        const err = httpError(409, '袋已在其他设备更新，请先拉取', 'STAMP_BAG_STALE');
        err.bag = await getBag(userId);
        throw err;
      }
    }
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      const stale = httpError(409, '袋已在其他设备更新，请先拉取', 'STAMP_BAG_STALE');
      stale.bag = await getBag(userId);
      throw stale;
    }
    throw err;
  }
  return publicBag({
    inventory_blob: bag.inventoryBlob,
    check_in_blob: bag.checkInBlob,
    welcome_picked: bag.welcomePicked ? 1 : 0,
    gift_claimed_ids: bag.giftClaimedIds,
    revision: bag.revision,
  });
}

async function deleteBag(userId) {
  await query(`DELETE FROM stamp_bags WHERE user_id = ?`, [userId]);
}

module.exports = { getBag, putBag, deleteBag };
