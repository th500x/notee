/**
 * One pet bag per One Line UUID. Revision CAS so two devices cannot silently clobber.
 * Product: sibling notee-go docs/00-4 §10.2
 */

const { query } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const { parseBody, publicBag } = require('../lib/petBagRules');
const { requireActiveUser } = require('./userService');

async function getBag(userId) {
  await requireActiveUser(userId);
  const rows = await query(`SELECT * FROM pet_bags WHERE user_id = ? LIMIT 1`, [userId]);
  return publicBag(rows[0] || null);
}

async function putBag(userId, body) {
  await requireActiveUser(userId);
  const bag = parseBody(body);
  const rows = await query(`SELECT revision FROM pet_bags WHERE user_id = ? LIMIT 1`, [userId]);
  const current = rows[0] ? Number(rows[0].revision) : 0;
  if (current >= bag.revision) {
    const err = httpError(409, '袋已在其他设备更新，请先拉取', 'PET_BAG_STALE');
    err.bag = await getBag(userId);
    throw err;
  }
  try {
    if (!rows.length) {
      await query(
        `INSERT INTO pet_bags
          (user_id, bag_blob, welcome_claimed, tonight_day_key, revision)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          bag.bagBlob,
          bag.welcomeClaimed ? 1 : 0,
          bag.tonightDayKey,
          bag.revision,
        ]
      );
    } else {
      const result = await query(
        `UPDATE pet_bags
         SET bag_blob = ?, welcome_claimed = ?, tonight_day_key = ?, revision = ?
         WHERE user_id = ? AND revision < ?`,
        [
          bag.bagBlob,
          bag.welcomeClaimed ? 1 : 0,
          bag.tonightDayKey,
          bag.revision,
          userId,
          bag.revision,
        ]
      );
      if (!result.affectedRows) {
        const err = httpError(409, '袋已在其他设备更新，请先拉取', 'PET_BAG_STALE');
        err.bag = await getBag(userId);
        throw err;
      }
    }
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      const stale = httpError(409, '袋已在其他设备更新，请先拉取', 'PET_BAG_STALE');
      stale.bag = await getBag(userId);
      throw stale;
    }
    throw err;
  }
  return publicBag({
    bag_blob: bag.bagBlob,
    welcome_claimed: bag.welcomeClaimed ? 1 : 0,
    tonight_day_key: bag.tonightDayKey,
    revision: bag.revision,
  });
}

async function deleteBag(userId) {
  await query(`DELETE FROM pet_bags WHERE user_id = ?`, [userId]);
}

module.exports = { getBag, putBag, deleteBag };
