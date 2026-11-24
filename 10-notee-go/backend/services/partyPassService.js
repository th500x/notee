/**
 * Party Pass purchases and the staff Ultra flag.
 * Play tokens are verified before a row is written. Staff rows are not Play products.
 */

const crypto = require('crypto');
const { query, transaction } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const { normalizeLoginId } = require('../lib/loginId');
const {
  PRODUCTS,
  PRODUCT_99,
  PRODUCT_499,
  effectiveTier,
  upgradeAdjustment,
  productIdFor,
} = require('../lib/partyPass');
const { verifyProduct, listVoidedPurchases } = require('../lib/playPurchase');
const { rowToUser, findUserById } = require('./userService');
const { revokeLapsedHonor } = require('./honorLoginIdService');

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

function mapPurchase(row) {
  return {
    productId: row.product_id,
    state: row.state,
    createdAt: row.created_at,
    origin: row.origin,
  };
}

async function loadPurchases(conn, userId) {
  const [rows] = await conn.query(
    `SELECT product_id, state, origin, created_at
     FROM party_purchases WHERE user_id = ?`,
    [userId]
  );
  return rows.map(mapPurchase);
}

async function recompute(conn, userId) {
  const [users] = await conn.query(
    `SELECT party_ultra, party_upgrade_open, party_marks_total
     FROM users WHERE id = ? FOR UPDATE`,
    [userId]
  );
  const user = users[0];
  if (!user) throw httpError(404, '账号不存在', 'USER_GONE');
  const purchases = await loadPurchases(conn, userId);
  const tier = effectiveTier({ ultra: Number(user.party_ultra) === 1, purchases });
  const adjustment = upgradeAdjustment({
    purchases,
    upgradeOpen: Number(user.party_upgrade_open) === 1,
  });
  const marks = Number(user.party_marks_total) + adjustment.delta;
  const stored = tier === 'none' ? '' : tier;
  await conn.query(
    `UPDATE users
     SET party_pass = ?, party_marks_total = ?, party_upgrade_open = ?
     WHERE id = ?`,
    [stored, marks, adjustment.open ? 1 : 0, userId]
  );
  await revokeLapsedHonor(conn, userId, tier);
  return tier;
}

async function publicUser(userId) {
  const row = await findUserById(userId);
  if (!row) throw httpError(404, '账号不存在', 'USER_GONE');
  return rowToUser(row);
}

async function upsertPurchase(conn, { userId, productId, purchaseToken, origin, state }) {
  const hash = tokenHash(purchaseToken);
  const [existing] = await conn.query(
    `SELECT user_id FROM party_purchases WHERE token_hash = ? FOR UPDATE`,
    [hash]
  );
  if (existing[0] && existing[0].user_id !== userId) {
    throw httpError(409, '这笔购买属于另一个账号', 'PLAY_TOKEN_TAKEN');
  }
  if (existing[0]) {
    await conn.query(
      `UPDATE party_purchases SET state = ?, product_id = ? WHERE token_hash = ?`,
      [state, productId, hash]
    );
  } else {
    await conn.query(
      `INSERT INTO party_purchases (token_hash, user_id, product_id, origin, state)
       VALUES (?, ?, ?, ?, ?)`,
      [hash, userId, productId, origin, state]
    );
  }
}

async function applyVerified(userId, productId, purchaseToken, state) {
  if (!PRODUCTS[productId]) {
    throw httpError(400, '不是 Party Pass 商品', 'BAD_PRODUCT');
  }
  if (state === 'pending') {
    throw httpError(409, '这笔购买还在处理', 'PLAY_PENDING');
  }
  await transaction(async (conn) => {
    await upsertPurchase(conn, {
      userId,
      productId,
      purchaseToken,
      origin: 'play',
      state,
    });
    await recompute(conn, userId);
  });
  return publicUser(userId);
}

async function submitPlayPurchase(userId, body) {
  const productId = body && body.productId;
  const purchaseToken = body && body.purchaseToken;
  if (!PRODUCTS[productId] || typeof purchaseToken !== 'string' || !purchaseToken.trim()) {
    throw httpError(400, '购买凭证不完整', 'BAD_PURCHASE');
  }
  const state = await verifyProduct({ productId, purchaseToken: purchaseToken.trim() });
  return applyVerified(userId, productId, purchaseToken.trim(), state);
}

async function restorePlayPurchases(userId, body) {
  const list = body && body.purchases;
  if (!Array.isArray(list)) {
    throw httpError(400, '购买凭证不完整', 'BAD_PURCHASE');
  }
  for (const item of list) {
    if (!item || !PRODUCTS[item.productId] || typeof item.purchaseToken !== 'string') {
      throw httpError(400, '购买凭证不完整', 'BAD_PURCHASE');
    }
    const state = await verifyProduct({
      productId: item.productId,
      purchaseToken: item.purchaseToken.trim(),
    });
    if (state === 'pending') continue;
    await applyVerified(userId, item.productId, item.purchaseToken.trim(), state);
  }
  return publicUser(userId);
}

async function findUserIdByLogin(loginId) {
  const id = normalizeLoginId(loginId);
  const rows = await query(
    `SELECT id FROM users
     WHERE login_id = ? AND deleted_at IS NULL AND status = 'active'
     LIMIT 1`,
    [id]
  );
  if (!rows[0]) throw httpError(404, '短号没有对上账号', 'LOGIN_ID_UNKNOWN');
  return rows[0].id;
}

/**
 * Staff assignment. `none` clears Ultra and staff-origin rows. A still-valid Play
 * purchase is left in place, and the printed tier is whatever remains.
 */
async function grantStaff(loginId, tier) {
  const allowed = tier === 'none' || tier === '99' || tier === '499' || tier === 'ultra';
  if (!allowed) throw httpError(400, '档位只能是 none、99、499、ultra', 'BAD_TIER');
  const userId = await findUserIdByLogin(loginId);
  await transaction(async (conn) => {
    if (tier === 'ultra') {
      await conn.query(`UPDATE users SET party_ultra = 1 WHERE id = ?`, [userId]);
    } else if (tier === 'none') {
      await conn.query(`UPDATE users SET party_ultra = 0 WHERE id = ?`, [userId]);
      await conn.query(
        `UPDATE party_purchases SET state = 'canceled'
         WHERE user_id = ? AND origin = 'staff' AND state = 'purchased'`,
        [userId]
      );
    } else {
      const productId = productIdFor(tier);
      if (tier === '99') {
        await conn.query(
          `UPDATE party_purchases SET state = 'canceled'
           WHERE user_id = ? AND origin = 'staff' AND product_id = ? AND state = 'purchased'`,
          [userId, PRODUCT_499]
        );
      }
      await upsertPurchase(conn, {
        userId,
        productId,
        purchaseToken: `staff:${userId}:${productId}`,
        origin: 'staff',
        state: 'purchased',
      });
    }
    await recompute(conn, userId);
  });
  return publicUser(userId);
}

/**
 * Daily. Marks Play purchases Google has voided as canceled, then recomputes the tier.
 * A token we never recorded is skipped. A Play failure throws and changes no row
 * that has not already been committed.
 */
async function revokeVoidedPurchases() {
  const voided = await listVoidedPurchases();
  let matched = 0;
  let revoked = 0;
  for (const item of voided) {
    const hash = tokenHash(item.purchaseToken);
    const rows = await query(
      `SELECT user_id, state FROM party_purchases WHERE token_hash = ? LIMIT 1`,
      [hash]
    );
    const row = rows[0];
    if (!row) continue;
    matched += 1;
    if (row.state === 'canceled') continue;
    const changed = await transaction(async (conn) => {
      const [updated] = await conn.query(
        `UPDATE party_purchases SET state = 'canceled'
         WHERE token_hash = ? AND state <> 'canceled'`,
        [hash]
      );
      const count = updated && updated.affectedRows ? updated.affectedRows : 0;
      if (count > 0) await recompute(conn, row.user_id);
      return count;
    });
    if (changed > 0) revoked += 1;
  }
  return { fetched: voided.length, matched, revoked };
}

module.exports = {
  submitPlayPurchase,
  restorePlayPurchases,
  grantStaff,
  revokeVoidedPurchases,
};
