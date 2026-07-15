/**
 * AI 君主 · 每日传书（闲聊 + 局势 + 日俸）
 * @see docs/01-jun-exploration/40-ai/41-1-AI_KING_SYSTEM.md
 */

const { pool } = require('../database/connection');
const aiKingConfigService = require('./aiKingConfigService');
const kingDasikongRankingService = require('./kingDasikongRankingService');
const { insertRewardText } = require('./textDeliveryService');
const kingDailyLetterContentService = require('./kingDailyLetterContentService');
const factionOverviewService = require('./factionOverviewService');
const { EVENT_ID, MAIL_EXPIRE_HOURS, SYS_SENDER_ID } = require('../config/kingDailyLetter');

function logLetter(msg, extra) {
  if (extra !== undefined) {
    console.log(`[aiKing][dailyLetter] ${msg}`, typeof extra === 'string' ? extra : JSON.stringify(extra));
  } else {
    console.log(`[aiKing][dailyLetter] ${msg}`);
  }
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} factionId
 */
async function listRealPlayersInFaction(connection, factionId) {
  const [rows] = await connection.query(
    `SELECT p.player_id AS playerId, p.character_name AS characterName
     FROM players p
     INNER JOIN accounts a ON a.id = p.player_id
       AND COALESCE(NULLIF(TRIM(a.account_type), ''), 'real') = 'real'
       AND a.status = 'active'
     WHERE p.faction_id = ? AND p.player_id <> 'sys1'`,
    [factionId],
  );
  return rows || [];
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {object} king
 * @param {object} snap
 * @param {string} ymd
 * @param {{ playerId: string, characterName?: string }} player
 * @param {boolean} attachStipend
 */
async function sendDailyLetter(connection, king, snap, ymd, player, attachStipend) {
  const subject = `【${king.characterName || '君主'}诏】每日传书`;
  const content = kingDailyLetterContentService.buildDailyLetterContent({
    king,
    snap,
    ymd,
    playerId: player.playerId,
  });
  const attachments = attachStipend ? { grantDailyStipend: true } : {};
  const textId = await insertRewardText(
    {
      receiverId: player.playerId,
      senderId: SYS_SENDER_ID,
      senderName: king.characterName || '君主',
      senderPosition: '君主',
      subject,
      content,
      mailType: attachStipend ? 'reward' : 'system',
      expireHours: MAIL_EXPIRE_HOURS,
      attachments,
    },
    connection,
  );
  return textId;
}

/**
 * @param {string} factionId
 * @param {object} [king]
 */
async function runDailyTickForFaction(factionId, king) {
  const fid = String(factionId || '').trim();
  if (!fid) return { ok: false, error: '缺少 factionId' };

  const k = king || aiKingConfigService.getKingByFactionId(fid);
  if (!k) return { ok: false, factionId: fid, error: '无 AI 君主配置' };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (await kingDasikongRankingService.hasProcessedToday(connection, fid, EVENT_ID)) {
      await connection.rollback();
      logLetter(`tick skip faction=${fid} reason=already_processed_today`);
      return { ok: true, factionId: fid, skipped: true, reason: 'already_processed_today' };
    }

    const todayYmd = await kingDasikongRankingService.getServerDateYmd(connection);
    const snap = await kingDailyLetterContentService.buildSituationSnapshot(fid, k);
    const overview = await factionOverviewService.getFactionOverviewByFactionId(fid);
    const supplyTier = overview?.data?.supplyTier ?? null;
    const attachStipend = supplyTier != null;

    const players = await listRealPlayersInFaction(connection, fid);
    const textIds = [];
    for (const pl of players) {
      const textId = await sendDailyLetter(connection, k, snap, todayYmd, pl, attachStipend);
      textIds.push({ playerId: pl.playerId, textId });
    }

    await kingDasikongRankingService.resetFactionBaselines(connection, fid, todayYmd, EVENT_ID);
    await connection.commit();

    logLetter(`tick done faction=${fid}`, {
      players: players.length,
      attachStipend,
      situationTag: snap.situationTag,
      textCount: textIds.length,
    });

    return {
      ok: true,
      factionId: fid,
      baselineDate: todayYmd,
      playerCount: players.length,
      attachStipend,
      situationTag: snap.situationTag,
      textIds,
    };
  } catch (e) {
    await connection.rollback();
    console.error(`[aiKing][dailyLetter] faction=${fid} tick failed:`, e?.message || e, e?.stack || '');
    return { ok: false, factionId: fid, error: e.message || String(e) };
  } finally {
    connection.release();
  }
}

/**
 * @param {{ factionId?: string }} [opts]
 */
async function runDailyTick(opts = {}) {
  const onlyFaction = opts.factionId != null ? String(opts.factionId).trim() : '';
  const kings = aiKingConfigService.listAllKings().filter(
    (k) => !onlyFaction || k.factionId === onlyFaction,
  );

  const results = [];
  for (const king of kings) {
    results.push(await runDailyTickForFaction(king.factionId, king));
  }
  return { ok: true, results };
}

/**
 * 启动补跑：当日尚未标记 processed 则补发
 */
async function runStaleCatchUpOnStartup() {
  const kings = aiKingConfigService.listAllKings();
  if (!kings.length) return { ok: true, results: [] };

  const results = [];
  for (const king of kings) {
    const conn = await pool.getConnection();
    try {
      if (await kingDasikongRankingService.hasProcessedToday(conn, king.factionId, EVENT_ID)) {
        results.push({ factionId: king.factionId, skipped: true, reason: 'already_processed_today' });
        continue;
      }
      console.warn(`[aiKing][dailyLetter] startup catch-up faction=${king.factionId}`);
      results.push(await runDailyTickForFaction(king.factionId, king));
    } finally {
      conn.release();
    }
  }
  logLetter('startup catch-up done', results);
  return { ok: true, results };
}

module.exports = {
  runDailyTick,
  runDailyTickForFaction,
  runStaleCatchUpOnStartup,
  listRealPlayersInFaction,
};
