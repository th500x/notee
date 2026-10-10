/**
 * One favorite list per One Line UUID. Revision CAS so two devices cannot silently clobber.
 * Product: sibling notee-go docs/05 §3.3.2a
 */

const { query } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const { parseBody, publicBag, encodeBlob } = require('../lib/lyricFavoriteRules');
const { requireActiveUser } = require('./userService');

async function getBag(userId) {
  await requireActiveUser(userId);
  const rows = await query(
    `SELECT * FROM lyric_favorite_bags WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return publicBag(rows[0] || null);
}

async function putBag(userId, body) {
  await requireActiveUser(userId);
  const bag = parseBody(body);
  const rows = await query(
    `SELECT revision FROM lyric_favorite_bags WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const current = rows[0] ? Number(rows[0].revision) : 0;
  if (current >= bag.revision) {
    const err = httpError(409, '收藏已在其他设备更新，请先拉取', 'LYRIC_FAVORITES_STALE');
    err.bag = await getBag(userId);
    throw err;
  }
  const blob = encodeBlob(bag.ids);
  try {
    if (!rows.length) {
      await query(
        `INSERT INTO lyric_favorite_bags (user_id, bag_blob, revision) VALUES (?, ?, ?)`,
        [userId, blob, bag.revision]
      );
    } else {
      const result = await query(
        `UPDATE lyric_favorite_bags
         SET bag_blob = ?, revision = ?
         WHERE user_id = ? AND revision < ?`,
        [blob, bag.revision, userId, bag.revision]
      );
      if (!result.affectedRows) {
        const err = httpError(409, '收藏已在其他设备更新，请先拉取', 'LYRIC_FAVORITES_STALE');
        err.bag = await getBag(userId);
        throw err;
      }
    }
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      const stale = httpError(409, '收藏已在其他设备更新，请先拉取', 'LYRIC_FAVORITES_STALE');
      stale.bag = await getBag(userId);
      throw stale;
    }
    throw err;
  }
  return publicBag({ bag_blob: blob, revision: bag.revision });
}

async function deleteBag(userId) {
  await query(`DELETE FROM lyric_favorite_bags WHERE user_id = ?`, [userId]);
}

module.exports = { getBag, putBag, deleteBag };
