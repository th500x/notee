/**
 * Gift inbox: evaluate campaigns at read time; claim is insert-first then return payload.
 */

const { randomUUID } = require('crypto');
const { query, transaction } = require('../database/connection');
const { httpError } = require('../lib/httpError');
const {
  assertAudience,
  assertCampaignId,
  buildPayload,
  parseLoginIds,
  parsePayload,
  publicCampaign,
  asObject,
} = require('../lib/giftRules');
const { requireActiveUser } = require('./userService');

function payloadJson(kind, payload) {
  return JSON.stringify(parsePayload(kind, payload));
}

async function createCampaign(input) {
  const audience = assertAudience(input.audience);
  const requireLoginId = Boolean(input.requireLoginId);
  const { kind, payload } = buildPayload(input.kind, input.itemId);
  const note = input.note ? String(input.note).slice(0, 255) : null;
  const id = randomUUID();

  let targets = [];
  if (audience === 'login_ids') {
    const loginIds = parseLoginIds(input.loginIds);
    if (loginIds.length === 0) {
      throw httpError(400, 'login_ids 受众需要短号列表', 'GIFT_LOGIN_IDS_REQUIRED');
    }
    const placeholders = loginIds.map(() => '?').join(',');
    const rows = await query(
      `SELECT id, login_id FROM users
       WHERE status = 'active' AND deleted_at IS NULL AND login_id IN (${placeholders})`,
      loginIds
    );
    const found = new Set(rows.map((r) => r.login_id));
    const missing = loginIds.filter((x) => !found.has(x));
    if (missing.length) {
      const err = httpError(400, `短号不存在或已失效：${missing.join(',')}`, 'GIFT_LOGIN_ID_UNKNOWN');
      err.missing = missing;
      throw err;
    }
    targets = rows.map((r) => ({ userId: r.id, loginId: r.login_id }));
  }

  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO gift_campaigns
        (id, kind, payload, audience, require_login_id, status, note)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [id, kind, payloadJson(kind, payload), audience, requireLoginId ? 1 : 0, note]
    );
    for (const t of targets) {
      await conn.execute(
        `INSERT INTO gift_campaign_targets (campaign_id, user_id, login_id) VALUES (?, ?, ?)`,
        [id, t.userId, t.loginId]
      );
    }
  });

  return {
    id,
    kind,
    payload,
    audience,
    requireLoginId,
    targetCount: targets.length,
    note,
  };
}

async function cancelCampaign(campaignId) {
  const id = assertCampaignId(campaignId);
  const result = await query(
    `UPDATE gift_campaigns SET status = 'cancelled' WHERE id = ? AND status = 'active'`,
    [id]
  );
  if (!result.affectedRows) {
    throw httpError(404, '活动不存在或已取消', 'GIFT_NOT_FOUND');
  }
  return { id, status: 'cancelled' };
}

async function loadCampaign(id) {
  const rows = await query(`SELECT * FROM gift_campaigns WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

function inWindow(row) {
  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
  if (row.ends_at && new Date(row.ends_at).getTime() <= now) return false;
  return true;
}

async function listInbox(userId) {
  const user = await requireActiveUser(userId);
  const rows = await query(
    `SELECT c.* FROM gift_campaigns c
     WHERE c.status = 'active'
       AND c.audience IN ('all', 'login_ids')
       AND (c.starts_at IS NULL OR c.starts_at <= UTC_TIMESTAMP())
       AND (c.ends_at IS NULL OR c.ends_at > UTC_TIMESTAMP())
       AND (c.require_login_id = 0 OR ? IS NOT NULL)
       AND (c.audience <> 'login_ids' OR EXISTS (
         SELECT 1 FROM gift_campaign_targets t
         WHERE t.campaign_id = c.id AND t.user_id = ?
       ))
       AND NOT EXISTS (
         SELECT 1 FROM gift_claims cl
         WHERE cl.campaign_id = c.id AND cl.user_id = ?
       )
     ORDER BY c.created_at ASC`,
    [user.login_id, userId, userId]
  );
  return rows.filter(inWindow).map(publicCampaign);
}

async function isEligible(row, user) {
  if (!row || row.status !== 'active') return false;
  if (!inWindow(row)) return false;
  if (row.audience !== 'all' && row.audience !== 'login_ids') return false;
  if (Number(row.require_login_id) && !user.login_id) return false;
  if (row.audience === 'login_ids') {
    const hits = await query(
      `SELECT 1 FROM gift_campaign_targets WHERE campaign_id = ? AND user_id = ? LIMIT 1`,
      [row.id, user.id]
    );
    if (!hits.length) return false;
  }
  return true;
}

async function claim(userId, campaignId) {
  const id = assertCampaignId(campaignId);
  const user = await requireActiveUser(userId);
  const row = await loadCampaign(id);
  if (!(await isEligible(row, user))) {
    const existing = await query(
      `SELECT payload_snapshot FROM gift_claims WHERE campaign_id = ? AND user_id = ? LIMIT 1`,
      [id, userId]
    );
    if (existing.length) {
      return publicCampaign({
        id,
        kind: row ? row.kind : asObject(existing[0].payload_snapshot)?.kind,
        payload: existing[0].payload_snapshot,
      });
    }
    throw httpError(404, '没有这件待领赠品', 'GIFT_UNAVAILABLE');
  }

  const snapshot = payloadJson(row.kind, row.payload);
  try {
    await query(
      `INSERT INTO gift_claims (campaign_id, user_id, payload_snapshot) VALUES (?, ?, ?)`,
      [id, userId, snapshot]
    );
  } catch (err) {
    if (err && err.code !== 'ER_DUP_ENTRY') throw err;
  }
  const claimed = await query(
    `SELECT payload_snapshot FROM gift_claims WHERE campaign_id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  return publicCampaign({ id, kind: row.kind, payload: claimed[0].payload_snapshot });
}

async function inboxForLoginId(loginIdRaw) {
  const { normalizeLoginId } = require('../lib/loginId');
  const loginId = normalizeLoginId(loginIdRaw);
  const rows = await query(
    `SELECT id FROM users WHERE login_id = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    [loginId]
  );
  if (!rows.length) {
    throw httpError(404, '短号不存在', 'GIFT_LOGIN_ID_UNKNOWN');
  }
  return listInbox(rows[0].id);
}

module.exports = {
  createCampaign,
  cancelCampaign,
  listInbox,
  claim,
  inboxForLoginId,
};
