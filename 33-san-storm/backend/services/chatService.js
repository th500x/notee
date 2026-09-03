/**
 * 聊天（chats 表）— 天下 / 势力 / 军团
 * 权限与冷却见 docs/01-jun-exploration/10-core-system/18-3-CHAT_SYSTEM.md；position_level 越小官职越高
 */

const { pool } = require('../database/connection');

const LIMITS = {
  world: { maxPositionLevel: 7, cooldownMs: 30000, maxLength: 100, dailyLimit: 50 },
  faction: { maxPositionLevel: 7, cooldownMs: 10000, maxLength: 100, dailyLimit: 50 },
  legion: { maxPositionLevel: 5, cooldownMs: 10000, maxLength: 100, dailyLimit: 50 },
};

const DEFAULT_LOWEST_RANK = 8;

function normalizeChannelType(t) {
  const s = (t || '').trim().toLowerCase();
  if (s === 'world' || s === 'faction' || s === 'legion') return s;
  return null;
}

function rowToClient(row, extras = {}) {
  if (!row) return null;
  return {
    chatId: String(row.chat_id),
    channelType: row.channel_type,
    channelId: row.channel_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderFactionId: row.sender_faction_id,
    content: row.content,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    ...extras,
  };
}

async function getPlayerRow(playerId) {
  const [rows] = await pool.query(
    `SELECT player_id, character_name, faction_id, position_level
     FROM players WHERE player_id = ?`,
    [playerId]
  );
  return rows[0] || null;
}

async function isLegionMember(playerId, legionId) {
  if (!legionId) return false;
  const [rows] = await pool.query(
    'SELECT 1 FROM legion_members WHERE player_id = ? AND legion_id = ? LIMIT 1',
    [playerId, legionId]
  );
  return rows.length > 0;
}

async function getFactionLabel(factionId) {
  if (!factionId) return null;
  const [rows] = await pool.query(
    `SELECT faction_name FROM config_factions WHERE faction_id = ? ORDER BY season DESC LIMIT 1`,
    [factionId]
  );
  return rows[0]?.faction_name || null;
}

async function getLegionLabel(legionId) {
  if (!legionId) return null;
  const [rows] = await pool.query(
    'SELECT legion_name FROM legions WHERE legion_id = ? LIMIT 1',
    [legionId]
  );
  return rows[0]?.legion_name || null;
}

function basicFilterContent(text) {
  let s = String(text || '').trim();
  if (s.length > LIMITS.world.maxLength) s = s.slice(0, LIMITS.world.maxLength);
  return s;
}

/**
 * 校验发送权限与冷却、日限；通过则插入 chats
 * @returns {{ ok: true, message: object } | { ok: false, code: string, error: string }}
 */
async function sendMessage(playerId, { channelType: rawType, channelId: rawChannelId, content: rawContent }) {
  const channelType = normalizeChannelType(rawType);
  if (!channelType) {
    return { ok: false, code: 'BAD_CHANNEL', error: '无效的频道类型' };
  }

  const player = await getPlayerRow(playerId);
  if (!player) {
    return { ok: false, code: 'NO_PLAYER', error: '玩家不存在' };
  }

  const pos = player.position_level != null ? Number(player.position_level) : DEFAULT_LOWEST_RANK;
  const lim = LIMITS[channelType];

  if (pos > lim.maxPositionLevel) {
    return { ok: false, code: 'POSITION', error: '官职不足，无法在此频道发言' };
  }

  let channelId = rawChannelId != null && rawChannelId !== '' ? String(rawChannelId).trim() : null;
  if (channelType === 'world') {
    channelId = null;
  } else if (!channelId) {
    return { ok: false, code: 'BAD_CHANNEL', error: '缺少 channelId' };
  }

  if (channelType === 'faction') {
    if (player.faction_id !== channelId) {
      return { ok: false, code: 'FACTION', error: '不属于该势力' };
    }
  }
  if (channelType === 'legion') {
    const okLeg = await isLegionMember(playerId, channelId);
    if (!okLeg) {
      return { ok: false, code: 'LEGION', error: '不属于该军团' };
    }
  }

  const content = basicFilterContent(rawContent);
  if (!content) {
    return { ok: false, code: 'EMPTY', error: '内容不能为空' };
  }

  const lastRows = await pool.query(
    `SELECT created_at FROM chats
     WHERE sender_id = ? AND channel_type = ?
       AND (channel_id <=> ?)
     ORDER BY created_at DESC LIMIT 1`,
    [playerId, channelType, channelId]
  );
  const last = lastRows[0]?.[0];
  if (last?.created_at) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    if (elapsed < lim.cooldownMs) {
      const waitSec = Math.ceil((lim.cooldownMs - elapsed) / 1000);
      return { ok: false, code: 'COOLDOWN', error: `请等待 ${waitSec} 秒后再发言` };
    }
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM chats
     WHERE sender_id = ? AND channel_type = ?
       AND (channel_id <=> ?)
       AND DATE(created_at) = CURDATE()
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [playerId, channelType, channelId]
  );
  const todayCount = Number(countRows[0]?.c || 0);
  if (todayCount >= lim.dailyLimit) {
    return { ok: false, code: 'DAILY', error: '今日该频道发言次数已达上限' };
  }

  const senderName = player.character_name || playerId;
  const [ins] = await pool.query(
    `INSERT INTO chats (
       channel_type, channel_id, sender_id, sender_name, sender_faction_id, content, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 3 DAY))`,
    [channelType, channelId, playerId, senderName, player.faction_id || null, content]
  );

  const chatId = ins.insertId;
  const [rows] = await pool.query(
    `SELECT chat_id, channel_type, channel_id, sender_id, sender_name, sender_faction_id,
            content, created_at, expires_at
     FROM chats WHERE chat_id = ?`,
    [chatId]
  );

  const msg = rowToClient(rows[0]);
  if (channelType === 'faction' && channelId) {
    msg.channelLabel = await getFactionLabel(channelId);
  } else if (channelType === 'legion' && channelId) {
    msg.channelLabel = await getLegionLabel(channelId);
  }

  return { ok: true, message: msg };
}

/**
 * 拉取频道消息；viewer 需有权查看该频道
 */
async function listMessages(viewerPlayerId, { channelType: rawType, channelId: rawChannelId, limit = 100 }) {
  const channelType = normalizeChannelType(rawType);
  if (!channelType) {
    return { ok: false, error: '无效的频道类型' };
  }

  let channelId = rawChannelId != null && rawChannelId !== '' ? String(rawChannelId).trim() : null;
  if (channelType === 'world') {
    channelId = null;
  } else if (!channelId) {
    return { ok: false, error: '缺少 channelId' };
  }

  const viewer = await getPlayerRow(viewerPlayerId);
  if (!viewer) {
    return { ok: false, error: '玩家不存在' };
  }

  if (channelType === 'faction' && viewer.faction_id !== channelId) {
    return { ok: false, error: '无权查看该势力频道' };
  }
  if (channelType === 'legion') {
    const okLeg = await isLegionMember(viewerPlayerId, channelId);
    if (!okLeg) {
      return { ok: false, error: '无权查看该军团频道' };
    }
  }

  const lim = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const [rows] = await pool.query(
    `SELECT chat_id, channel_type, channel_id, sender_id, sender_name, sender_faction_id,
            content, created_at, expires_at
     FROM chats
     WHERE channel_type = ?
       AND (channel_id <=> ?)
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC
     LIMIT ?`,
    [channelType, channelId, lim]
  );

  const messages = [];
  let channelLabel = null;
  if (channelType === 'faction' && channelId) {
    channelLabel = await getFactionLabel(channelId);
  } else if (channelType === 'legion' && channelId) {
    channelLabel = await getLegionLabel(channelId);
  }

  for (const row of rows) {
    messages.push(rowToClient(row, channelLabel ? { channelLabel } : {}));
  }
  // 与 SQL「DESC」一致：messages[0] 为最新一条；前端自上而下展示时，最新在最上方

  return {
    ok: true,
    messages,
    channelLabel: channelLabel || undefined,
  };
}

/**
 * 轻量检测：频道内当前最大 chat_id（未过期消息），供前端轮询对比，避免拉全量列表
 */
async function getChannelMeta(viewerPlayerId, { channelType: rawType, channelId: rawChannelId }) {
  const channelType = normalizeChannelType(rawType);
  if (!channelType) {
    return { ok: false, error: '无效的频道类型' };
  }

  let channelId = rawChannelId != null && rawChannelId !== '' ? String(rawChannelId).trim() : null;
  if (channelType === 'world') {
    channelId = null;
  } else if (!channelId) {
    return { ok: false, error: '缺少 channelId' };
  }

  const viewer = await getPlayerRow(viewerPlayerId);
  if (!viewer) {
    return { ok: false, error: '玩家不存在' };
  }

  if (channelType === 'faction' && viewer.faction_id !== channelId) {
    return { ok: false, error: '无权查看该势力频道' };
  }
  if (channelType === 'legion') {
    const okLeg = await isLegionMember(viewerPlayerId, channelId);
    if (!okLeg) {
      return { ok: false, error: '无权查看该军团频道' };
    }
  }

  const [rows] = await pool.query(
    `SELECT COALESCE(MAX(chat_id), 0) AS max_id
     FROM chats
     WHERE channel_type = ?
       AND (channel_id <=> ?)
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [channelType, channelId]
  );
  const maxId = rows[0]?.max_id;
  return {
    ok: true,
    maxChatId: maxId != null ? String(maxId) : '0',
  };
}

/**
 * 玩家所在军团（至多一条，用于聊天 Tab）；无则 null
 */
async function getLegionForPlayer(playerId) {
  try {
    const [rows] = await pool.query(
      `SELECT l.legion_id AS legionId, l.legion_name AS legionName
       FROM legion_members m
       INNER JOIN legions l ON l.legion_id = m.legion_id
       WHERE m.player_id = ?
       LIMIT 1`,
      [playerId]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      legionId: r.legionId ?? r.legion_id,
      legionName: r.legionName ?? r.legion_name,
    };
  } catch (e) {
    console.warn('[chatService] getLegionForPlayer:', e.message);
    return null;
  }
}

module.exports = {
  sendMessage,
  listMessages,
  getChannelMeta,
  getLegionForPlayer,
  LIMITS,
};
