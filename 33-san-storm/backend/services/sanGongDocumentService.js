/**
 * 三公府 · 朝政 · 文书：一品官职（position_level = 1）每日发布势力公告
 */

const { pool } = require('../database/connection');
const factionBulletinService = require('./factionBulletinService');

const MAX_PER_CALENDAR_DAY = 3;
const TIER1_POSITION_LEVEL = 1;
/** 与真三日报公告节选上限一致（32-6 §4.2-E） */
const MAX_BODY_LEN = 60;

function mysqlDateToYmd(val) {
  if (val == null) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * @param {string} playerId
 */
async function getDocumentDailyStatus(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) {
    return {
      canPost: false,
      usedToday: 0,
      remainingToday: 0,
      maxPerDay: MAX_PER_CALENDAR_DAY,
      blockReason: '未登录',
    };
  }

  const [pRows] = await pool.query(
    'SELECT faction_id, position_level, current_position_name, character_name FROM players WHERE player_id = ? LIMIT 1',
    [pid],
  );
  const p = pRows[0];
  if (!p?.faction_id) {
    return {
      canPost: false,
      usedToday: 0,
      remainingToday: 0,
      maxPerDay: MAX_PER_CALENDAR_DAY,
      blockReason: '无势力',
    };
  }
  if (Number(p.position_level) !== TIER1_POSITION_LEVEL) {
    return {
      canPost: false,
      usedToday: 0,
      remainingToday: 0,
      maxPerDay: MAX_PER_CALENDAR_DAY,
      blockReason: '仅一品官职（position_level = 1）可发布文书',
    };
  }

  await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
  const [rows] = await pool.query(
    'SELECT san_gong_document_date, san_gong_document_count FROM player_events WHERE player_id = ?',
    [pid],
  );
  const row = rows[0] || {};
  const [dr] = await pool.query('SELECT CURDATE() AS d');
  const todayStr = mysqlDateToYmd(dr[0].d);
  const stored = mysqlDateToYmd(row.san_gong_document_date);
  let used = 0;
  if (stored && stored === todayStr) {
    used = Math.max(0, Math.min(MAX_PER_CALENDAR_DAY, Number(row.san_gong_document_count) || 0));
  }
  const remaining = Math.max(0, MAX_PER_CALENDAR_DAY - used);
  return {
    canPost: remaining > 0,
    usedToday: used,
    remainingToday: remaining,
    maxPerDay: MAX_PER_CALENDAR_DAY,
    blockReason: remaining > 0 ? null : '今日文书发布次数已用完（上限 3 条/天）',
    positionName: p.current_position_name || null,
    characterName: p.character_name || null,
  };
}

/**
 * @param {string} playerId
 * @param {string} rawBody
 */
async function postDocument(playerId, rawBody) {
  const pid = String(playerId || '').trim();
  const text = String(rawBody || '').trim();
  if (!pid) return { ok: false, status: 400, error: '未登录' };
  if (!text) return { ok: false, status: 400, error: '文书内容不能为空' };
  if (text.length > MAX_BODY_LEN) {
    return { ok: false, status: 400, error: `文书内容过长（最多 ${MAX_BODY_LEN} 字）` };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [pRows] = await conn.query(
      'SELECT faction_id, position_level, current_position_name, character_name FROM players WHERE player_id = ? FOR UPDATE',
      [pid],
    );
    const p = pRows[0];
    if (!p?.faction_id) {
      await conn.rollback();
      return { ok: false, status: 400, error: '无势力' };
    }
    if (Number(p.position_level) !== TIER1_POSITION_LEVEL) {
      await conn.rollback();
      return { ok: false, status: 403, error: '仅一品官职（position_level = 1）可发布文书' };
    }

    await conn.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    const [peRows] = await conn.query(
      'SELECT san_gong_document_date, san_gong_document_count FROM player_events WHERE player_id = ? FOR UPDATE',
      [pid],
    );
    const pe = peRows[0] || {};
    const [dr] = await conn.query('SELECT CURDATE() AS d');
    const todayStr = mysqlDateToYmd(dr[0].d);
    const stored = mysqlDateToYmd(pe.san_gong_document_date);
    let used = 0;
    if (stored && stored === todayStr) {
      used = Math.max(0, Number(pe.san_gong_document_count) || 0);
    }
    if (used >= MAX_PER_CALENDAR_DAY) {
      await conn.rollback();
      return { ok: false, status: 400, error: '今日文书发布次数已用完（上限 3 条/天）' };
    }

    const posLabel = p.current_position_name ? `[${p.current_position_name}]` : '';
    const nameLabel = p.character_name || pid;
    const displayName = `${posLabel}${nameLabel}`.slice(0, 128);
    const bodyLine = `${displayName}：${text}`;

    const entryId = await factionBulletinService.appendOnConnection(conn, p.faction_id, bodyLine, {
      category: factionBulletinService.CATEGORY.DOCUMENT,
      authorPlayerId: pid,
      authorName: displayName,
    });

    await conn.query(
      'UPDATE player_events SET san_gong_document_date = ?, san_gong_document_count = ? WHERE player_id = ?',
      [todayStr, used + 1, pid],
    );

    await conn.commit();
    return {
      ok: true,
      data: {
        id: entryId,
        body: bodyLine,
        usedToday: used + 1,
        remainingToday: Math.max(0, MAX_PER_CALENDAR_DAY - used - 1),
      },
    };
  } catch (e) {
    await conn.rollback();
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_document/i.test(msg)) {
      return { ok: false, status: 503, error: '文书日限字段未迁移，请联系管理员执行 player-events-add-san-gong-document-daily.sql' };
    }
    if (/Unknown column ['`]category/i.test(msg)) {
      return { ok: false, status: 503, error: '公告分类字段未迁移，请联系管理员执行 add-faction-bulletins-category.sql' };
    }
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  getDocumentDailyStatus,
  postDocument,
  MAX_PER_CALENDAR_DAY,
  TIER1_POSITION_LEVEL,
};
