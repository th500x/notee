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

function logDasikong(msg, extra) {
  if (extra !== undefined) {
    console.log(`[aiKing][dasikong] ${msg}`, typeof extra === 'string' ? extra : JSON.stringify(extra));
  } else {
    console.log(`[aiKing][dasikong] ${msg}`);
  }
}

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
    const diag = await kingDasikongRankingService.getFactionDasikongDiagnostic(connection, fid, EVENT_ID);
    logDasikong(`tick start faction=${fid}`, {
      processedToday: diag.processedToday,
      stale: diag.stale,
      maxBaselineDate: diag.maxBaselineDate,
      todayYmd: diag.todayYmd,
      snapCount: diag.snapCount,
      cronTz: diag.env?.cronTz,
      mysqlSessionTz: diag.env?.mysqlSessionTz,
    });

    await connection.beginTransaction();

    if (await kingDasikongRankingService.hasProcessedToday(connection, fid, EVENT_ID)) {
      await connection.rollback();
      logDasikong(`tick skip faction=${fid} reason=already_processed_today maxBaseline=${diag.maxBaselineDate}`);
      return { ok: true, factionId: fid, skipped: true, reason: 'already_processed_today' };
    }

    const todayYmd = await kingDasikongRankingService.getServerDateYmd(connection);
    const snapCount = await kingDasikongRankingService.countFactionSnapshots(connection, fid, EVENT_ID);

    if (snapCount === 0) {
      await kingDasikongRankingService.resetFactionBaselines(connection, fid, todayYmd, EVENT_ID);
      const afterCount = await kingDasikongRankingService.countFactionSnapshots(connection, fid, EVENT_ID);
      const eligible = await kingDasikongRankingService.countEligibleRealPlayers(connection, fid);
      const pastBootstrapDay = await kingDasikongRankingService.isFactionPastDasikongBootstrapDay(
        connection,
        fid,
      );

      if (afterCount === 0) {
        await connection.commit();
        console.log(
          `[aiKing][dasikong] faction=${fid} bootstrapped baselines (${todayYmd}) ` +
            `snapshots=0 eligibleReal=${eligible}`,
        );
        if (eligible > 0) {
          console.warn(
            `[aiKing][dasikong] faction=${fid} bootstrap inserted 0 snapshots despite ${eligible} eligible players — check temp_event_ranking migration`,
          );
        }
        return {
          ok: true,
          factionId: fid,
          bootstrapped: true,
          baselineDate: todayYmd,
          snapshotCount: 0,
          eligibleReal: eligible,
        };
      }

      if (!pastBootstrapDay) {
        await connection.commit();
        console.log(
          `[aiKing][dasikong] faction=${fid} bootstrapped baselines (${todayYmd}) ` +
            `snapshots=${afterCount} eligibleReal=${eligible} (first day, skip appointment)`,
        );
        return {
          ok: true,
          factionId: fid,
          bootstrapped: true,
          baselineDate: todayYmd,
          snapshotCount: afterCount,
          eligibleReal: eligible,
        };
      }

      // 迁移/清表恢复：仅补 baseline，不在「零增量」上决选（避免 tie-break 误任命）
      await connection.commit();
      console.log(
        `[aiKing][dasikong] faction=${fid} recovery bootstrap (${todayYmd}) ` +
          `snapshots=${afterCount} — skip appointment (no prior baseline)`,
      );
      return {
        ok: true,
        factionId: fid,
        recoveryBootstrap: true,
        skippedAppointment: true,
        baselineDate: todayYmd,
        snapshotCount: afterCount,
        eligibleReal: eligible,
      };
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
      const eligible = await kingDasikongRankingService.countEligibleRealPlayers(connection, fid);
      console.log(`[aiKing][dasikong] faction=${fid} no eligible winner (eligibleReal=${eligible})`);
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
    console.error(`[aiKing][dasikong] faction=${fid} tick failed:`, e?.message || e, e?.stack || '');
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

/**
 * 启动补跑：baseline_date 落后于 CURDATE() 时执行决选+重置（漏跑 0:00 tick 时自愈）
 */
async function runStaleCatchUpOnStartup() {
  const kings = aiKingConfigService.listAllKings();
  if (!kings.length) return { ok: true, results: [] };

  const probe = await pool.getConnection();
  let hasColumn;
  try {
    hasColumn = await kingDasikongRankingService.hasBaselineDateColumn(probe);
  } finally {
    probe.release();
  }
  if (!hasColumn) {
    console.error(
      '[aiKing][dasikong] 缺少 temp_event_ranking.baseline_date 列；请执行迁移 add-temp-ranking-snapshots-baseline-date.sql，否则 0:00 tick 会失败',
    );
    return { ok: false, error: 'missing_baseline_date_column' };
  }

  const results = [];
  for (const king of kings) {
    const conn = await pool.getConnection();
    try {
      if (await kingDasikongRankingService.hasProcessedToday(conn, king.factionId, EVENT_ID)) {
        results.push({ factionId: king.factionId, skipped: true, reason: 'already_processed_today' });
        continue;
      }
      const staleInfo = await kingDasikongRankingService.isFactionBaselineStale(conn, king.factionId, EVENT_ID);
      if (!staleInfo.stale) {
        results.push({ factionId: king.factionId, skipped: true, reason: 'baseline_current', ...staleInfo });
        continue;
      }
      console.warn(
        `[aiKing][dasikong] startup catch-up faction=${king.factionId} ` +
          `baseline=${staleInfo.maxBaselineDate || 'none'} today=${staleInfo.todayYmd}`,
      );
      results.push(await runDailyTickForFaction(king.factionId, king));
    } finally {
      conn.release();
    }
  }
  logDasikong('startup catch-up done', results);
  return { ok: true, results };
}

/** @param {string} factionId */
async function getFactionDasikongDiagnostic(factionId) {
  const conn = await pool.getConnection();
  try {
    return await kingDasikongRankingService.getFactionDasikongDiagnostic(conn, factionId, EVENT_ID);
  } finally {
    conn.release();
  }
}

module.exports = {
  runDailyTick,
  runDailyTickForFaction,
  runStaleCatchUpOnStartup,
  getFactionDasikongDiagnostic,
  buildAppointmentMailContent,
};
