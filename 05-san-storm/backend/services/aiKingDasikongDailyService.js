/**
 * AI 君主 · 每日 00:00 大司空任命
 * @see docs/40-ai/41-1-AI_KING_SYSTEM.md §每日大司空任命
 */

const { pool } = require('../database/connection');
const aiKingConfigService = require('./aiKingConfigService');
const kingDasikongRankingService = require('./kingDasikongRankingService');
const { demoteIfHoldingDasikong } = require('./positionFallbackService');
const { insertRewardText } = require('./textDeliveryService');
const factionBulletinService = require('./factionBulletinService');
const {
  EVENT_ID,
  DASIKONG_POSITION_ID,
  MAIL_EXPIRE_HOURS,
  SYS_SENDER_ID,
} = require('../config/kingDasikongDaily');

function buildAppointmentMailContent(king, winner, totalScore) {
  const kingName = king.characterName || '君主';
  const courtesy = king.courtesyName ? `（${king.courtesyName}）` : '';
  return (
    `${kingName}${courtesy}：\n` +
    `观卿昨日勤勉，列本势力群臣之首（${Math.max(0, Math.floor(totalScore))} 分），` +
    `特授大司空之职，并赐俸禄一份。请收诏领命，共理政事。\n` +
    `（传书 24 小时内有效，逾期失效。）`
  );
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function demoteOtherDasikongHolders(connection, factionId, winnerPlayerId) {
  const [holders] = await connection.query(
    `SELECT p.player_id FROM players p
     INNER JOIN accounts a ON a.id = p.player_id AND a.account_type = 'real'
     WHERE p.faction_id = ? AND p.current_position_id = ? AND p.player_id <> ?`,
    [factionId, DASIKONG_POSITION_ID, winnerPlayerId],
  );
  const demoted = [];
  for (const h of holders || []) {
    const r = await demoteIfHoldingDasikong(connection, {
      playerId: h.player_id,
      factionId,
      dasikongPositionId: DASIKONG_POSITION_ID,
    });
    if (r.changed) demoted.push({ playerId: h.player_id, ...r.detail });
  }
  return demoted;
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function sendAppointmentMail(connection, king, winner) {
  const subject = `【${king.characterName || '君主'}诏】大司空任命`;
  const content = buildAppointmentMailContent(king, winner, winner.totalScore);
  const textId = await insertRewardText(
    {
      receiverId: winner.playerId,
      senderId: SYS_SENDER_ID,
      senderName: king.characterName || '君主',
      senderPosition: '君主',
      subject,
      content,
      mailType: 'reward',
      expireHours: MAIL_EXPIRE_HOURS,
      attachments: {
        positionId: DASIKONG_POSITION_ID,
        grantKingStipend: true,
      },
    },
    connection,
  );
  return textId;
}

/**
 * @param {string} factionId
 * @param {object} [king] ai-kings.json 条目
 */
async function runDailyTickForFaction(factionId, king) {
  const fid = String(factionId || '').trim();
  if (!fid) return { ok: false, error: '缺少 factionId' };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (await kingDasikongRankingService.hasProcessedToday(connection, fid, EVENT_ID)) {
      await connection.rollback();
      return { ok: true, factionId: fid, skipped: true, reason: 'already_processed_today' };
    }

    const todayYmd = await kingDasikongRankingService.getServerDateYmd(connection);
    const snapCount = await kingDasikongRankingService.countFactionSnapshots(connection, fid, EVENT_ID);

    if (snapCount === 0) {
      await kingDasikongRankingService.resetFactionBaselines(connection, fid, todayYmd, EVENT_ID);
      await connection.commit();
      console.log(`[aiKing][dasikong] faction=${fid} bootstrapped baselines (${todayYmd})`);
      return { ok: true, factionId: fid, bootstrapped: true, baselineDate: todayYmd };
    }

    const winner = await kingDasikongRankingService.pickDailyWinner(connection, fid, EVENT_ID);
    let textId = null;
    let demoted = [];

    if (winner?.playerId) {
      demoted = await demoteOtherDasikongHolders(connection, fid, winner.playerId);
      textId = await sendAppointmentMail(connection, king, winner);
      await factionBulletinService.appendOnConnection(
        connection,
        fid,
        `【谕旨】${king.characterName || '君主'}：依昨日群臣功绩，册封 ${winner.characterName || winner.playerId} 为大司空（日榜 ${Math.max(0, Math.floor(winner.totalScore))} 分）。`,
        { category: factionBulletinService.CATEGORY.EDICT },
      );
      console.log(
        `[aiKing][dasikong] faction=${fid} winner=${winner.playerId}(${winner.characterName}) ` +
          `score=${winner.totalScore} textId=${textId} demoted=${demoted.length}`,
      );
    } else {
      console.log(`[aiKing][dasikong] faction=${fid} no eligible winner`);
    }

    await kingDasikongRankingService.resetFactionBaselines(connection, fid, todayYmd, EVENT_ID);
    await connection.commit();

    return {
      ok: true,
      factionId: fid,
      baselineDate: todayYmd,
      winner: winner || null,
      textId,
      demoted,
    };
  } catch (e) {
    await connection.rollback();
    console.error(`[aiKing][dasikong] faction=${fid} tick failed:`, e);
    return { ok: false, factionId: fid, error: e.message || String(e) };
  } finally {
    connection.release();
  }
}

/**
 * 全部 AI 君主势力（00:00 cron 入口）
 * @param {{ factionId?: string }} [opts] 可选仅跑单势力（调试）
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

module.exports = {
  runDailyTick,
  runDailyTickForFaction,
  buildAppointmentMailContent,
};
