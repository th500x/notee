/**
 * 玩家传书 inbox（texts 表）
 */

const { pool } = require('../database/connection');
const { grantSpecificCardsOnConnection, grantPositionOnConnection } = require('./rewardService');
const {
  grantKingStipendBonusOnConnection,
  grantDailyStipendOnConnection,
} = require('./sanGongStipendService');
const factionOverviewService = require('./factionOverviewService');
const statisticsDeltaService = require('./statisticsDeltaService');

const RESOURCE_KEYS = ['silver', 'food', 'reputation', 'contribution', 'morale'];

/** 与 MySQL utf8mb4_unicode_ci 一致：player_id 比较大小写不敏感；兼容 Buffer */
function normalizePlayerId(v) {
  if (v == null) return '';
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) return v.toString('utf8');
  return String(v);
}

function sameReceiverAsPlayer(rowReceiverId, playerId) {
  const a = normalizePlayerId(rowReceiverId);
  const b = normalizePlayerId(playerId);
  if (a === b) return true;
  return a.toLowerCase() === b.toLowerCase();
}

function parseAttachments(raw) {
  if (raw == null) return null;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    // 历史数据若把 cards 存成纯 JSON 数组，按 { cards } 解析以便正常发奖与生成 details
    if (Array.isArray(raw)) return { cards: raw };
    return raw;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function rowToClient(row) {
  if (!row) return null;
  return {
    textId: row.text_id,
    type: row.type,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderPosition: row.sender_position,
    subject: row.subject,
    content: row.content,
    attachments: parseAttachments(row.attachments),
    isClaimed: !!row.is_claimed,
    isRead: !!row.is_read,
    createdAt: row.created_at,
    readAt: row.read_at,
    expiresAt: row.expires_at,
    claimedAt: row.claimed_at
  };
}

async function countUnread(playerId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM texts
     WHERE receiver_id = ?
       AND is_deleted = FALSE
       AND is_read = FALSE
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [playerId]
  );
  return Number(rows[0]?.c || 0);
}

async function listInbox(playerId, { limit = 100 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const [rows] = await pool.query(
    `SELECT text_id, type, sender_id, sender_name, sender_position, subject, content,
            attachments, is_claimed, is_read, created_at, read_at, expires_at, claimed_at
     FROM texts
     WHERE receiver_id = ?
       AND is_deleted = FALSE
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC
     LIMIT ?`,
    [playerId, lim]
  );
  return rows.map(rowToClient);
}

async function getOne(playerId, textId) {
  const [rows] = await pool.query(
    `SELECT text_id, type, sender_id, sender_name, sender_position, subject, content,
            attachments, is_claimed, is_read, created_at, read_at, expires_at, claimed_at
     FROM texts
     WHERE text_id = ? AND receiver_id = ? AND is_deleted = FALSE`,
    [textId, playerId]
  );
  return rowToClient(rows[0] || null);
}

async function markRead(playerId, textId) {
  const [r] = await pool.query(
    `UPDATE texts SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
     WHERE text_id = ? AND receiver_id = ? AND is_deleted = FALSE`,
    [textId, playerId]
  );
  return r.affectedRows > 0;
}

/**
 * 领取奖励型传书：合并 attachments 中的数值资源与 items 对象
 */
async function claimReward(playerId, textId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT text_id, type, attachments, is_claimed, is_deleted, receiver_id, expires_at
       FROM texts WHERE text_id = ? FOR UPDATE`,
      [textId]
    );
    const row = rows[0];
    if (!row || !sameReceiverAsPlayer(row.receiver_id, playerId) || row.is_deleted) {
      await connection.rollback();
      return { ok: false, error: '传书不存在' };
    }
    if (row.expires_at && new Date(row.expires_at) <= new Date()) {
      await connection.rollback();
      return { ok: false, error: '传书已过期' };
    }
    if (row.type !== 'reward') {
      await connection.rollback();
      return { ok: false, error: '非奖励传书无需领取' };
    }
    if (row.is_claimed) {
      await connection.rollback();
      return { ok: false, error: '已领取过' };
    }

    const att = parseAttachments(row.attachments);
    if (!att || typeof att !== 'object') {
      await connection.query(
        `UPDATE texts SET is_claimed = TRUE, claimed_at = NOW() WHERE text_id = ?`,
        [textId]
      );
      await connection.commit();
      return { ok: true, details: [] };
    }

    const details = [];
    let stipendTacticTokenMerge = null;

    const [pRows] = await connection.query(
      'SELECT silver, food, reputation, contribution, morale, items, faction_id FROM players WHERE player_id = ? FOR UPDATE',
      [playerId]
    );
    if (!pRows[0]) {
      await connection.rollback();
      return { ok: false, error: '玩家不存在' };
    }

    const p = pRows[0];

    const positionId = att.positionId != null ? String(att.positionId).trim() : '';
    if (positionId) {
      const grant = await grantPositionOnConnection(connection, playerId, positionId);
      if (!grant.ok) {
        await connection.rollback();
        return { ok: false, error: grant.error || '授予官职失败' };
      }
      details.push(grant.detail);
    }

    if (att.grantKingStipend === true) {
      const overview = await factionOverviewService.getFactionOverviewForPlayer(playerId);
      if (overview?.notFound) {
        await connection.rollback();
        return { ok: false, error: '玩家不存在' };
      }
      const supplyTier = overview?.data?.supplyTier;
      const stipend = await grantKingStipendBonusOnConnection(connection, playerId, supplyTier);
      if (!stipend.ok) {
        await connection.rollback();
        return { ok: false, error: stipend.error || '俸禄发放失败' };
      }
      if (stipend.silver > 0) {
        details.push({ type: 'resource', resource: 'silver', amount: stipend.silver });
      }
      if (stipend.food > 0) {
        details.push({ type: 'resource', resource: 'food', amount: stipend.food });
      }
      if (stipend.reputationGrant > 0) {
        details.push({ type: 'resource', resource: 'reputation', amount: stipend.reputationGrant });
      }
      if (stipend.contributionGrant > 0) {
        details.push({ type: 'resource', resource: 'contribution', amount: stipend.contributionGrant });
      }
    }

    if (att.grantDailyStipend === true) {
      const stipend = await grantDailyStipendOnConnection(connection, playerId);
      if (!stipend.ok) {
        details.push({
          type: 'stipend_skip',
          reason: stipend.error || '日俸未发放',
        });
      } else {
        if (stipend.silver > 0) {
          details.push({ type: 'resource', resource: 'silver', amount: stipend.silver });
        }
        if (stipend.food > 0) {
          details.push({ type: 'resource', resource: 'food', amount: stipend.food });
        }
        if (stipend.tacticTokens > 0) {
          const tokId = stipend.tacticTokenItemId || 'item_tactic_token';
          details.push({
            type: 'item',
            itemId: tokId,
            quantity: stipend.tacticTokens,
            itemName: '兵符',
          });
          // 日俸已写入 items；下方会用开事务时快照再写 items，须合并以免冲掉兵符
          stipendTacticTokenMerge = { itemId: tokId, quantity: stipend.tacticTokens };
        }
      }
    }

    const updates = {};
    for (const key of RESOURCE_KEYS) {
      if (att[key] != null && Number.isFinite(Number(att[key]))) {
        const add = Math.floor(Number(att[key]));
        if (add !== 0) {
          updates[key] = (Number(p[key]) || 0) + add;
          details.push({ type: 'resource', resource: key, amount: add });
        }
      }
    }

    let items = p.items;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch {
        items = {};
      }
    }
    if (!items || typeof items !== 'object') items = {};

    if (stipendTacticTokenMerge) {
      const { itemId, quantity } = stipendTacticTokenMerge;
      items[itemId] = (Number(items[itemId]) || 0) + quantity;
    }

    if (att.items && typeof att.items === 'object' && !Array.isArray(att.items)) {
      for (const [itemId, qty] of Object.entries(att.items)) {
        const n = Math.floor(Number(qty));
        if (!itemId || !Number.isFinite(n) || n === 0) continue;
        items[itemId] = (Number(items[itemId]) || 0) + n;
        const [inRows] = await connection.query(
          'SELECT item_name FROM config_items WHERE item_id = ?',
          [itemId]
        );
        details.push({
          type: 'item',
          itemId,
          quantity: n,
          itemName: inRows[0]?.item_name || itemId
        });
      }
    }

    const sets = [];
    const vals = [];
    for (const key of RESOURCE_KEYS) {
      if (updates[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(updates[key]);
      }
    }
    if (sets.length) {
      vals.push(playerId);
      await connection.query(`UPDATE players SET ${sets.join(', ')} WHERE player_id = ?`, vals);
    }

    await connection.query(
      'UPDATE players SET items = ? WHERE player_id = ?',
      [JSON.stringify(items), playerId]
    );

    if (Array.isArray(att.cards) && att.cards.length > 0) {
      await grantSpecificCardsOnConnection(
        connection,
        playerId,
        p.faction_id || '',
        att.cards,
        details
      );
    }

    await connection.query(
      `UPDATE texts SET is_claimed = TRUE, claimed_at = NOW() WHERE text_id = ?`,
      [textId]
    );

    await connection.commit();

    if (positionId) {
      const { runPlayerMilestoneCheckSafe } = require('./milestoneHookHelper');
      runPlayerMilestoneCheckSafe(playerId, 'position_grant').catch(() => {});
    }
    if (Array.isArray(att.cards) && att.cards.some((id) => String(id).includes('_char_'))) {
      const { runPlayerMilestoneCheckSafe } = require('./milestoneHookHelper');
      runPlayerMilestoneCheckSafe(playerId, 'character_card_granted').catch(() => {});
    }

    if (att.grantKingStipend === true || att.grantDailyStipend === true) {
      const stipendDetail = details.filter((d) => d.type === 'resource');
      const earned = {};
      for (const d of stipendDetail) {
        if (d.resource === 'silver') earned.silver = (earned.silver || 0) + d.amount;
        if (d.resource === 'food') earned.food = (earned.food || 0) + d.amount;
        // 俸禄声望/贡献不进活动榜 earned；与 sanGongStipendService 一致
      }
      if (Object.keys(earned).length) {
        try {
          await statisticsDeltaService.recordEarned(playerId, earned);
        } catch (e) {
          console.warn('[textsService] recordEarned after stipend attachment:', e.message);
        }
      }
    }

    return { ok: true, details };
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

module.exports = {
  countUnread,
  listInbox,
  getOne,
  markRead,
  claimReward
};
