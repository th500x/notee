/**
 * 真三日报 · 势力战事目标日投票
 * - 00:00：结昨日票并开战 → 开今日新票（无战事且储备够）
 * - 候选：邻郡 ∩ 地图最近敌对/中立，按距己方城曼哈顿距取最近 3 座（可负担开战费）
 * - 投票：position_level ≤ 5；权重 floor(silverBonus/10)
 * @see docs/01-jun-exploration/30-frontend/32-6-DAILY_REPORT.md
 * @see docs/01-jun-exploration/10-core-system/17-3-WAR_SYSTEM.md
 */

const { pool } = require('../database/connection');
const aiKingConfigService = require('./aiKingConfigService');
const aiKingActiveDecisionService = require('./aiKingActiveDecisionService');
const warConcurrencyService = require('./warConcurrencyService');
const warInitiationCostService = require('./warInitiationCostService');
const factionReserveService = require('./factionReserveService');
const strategicWarTargetProximityService = require('./strategicWarTargetProximityService');
const gameTimeService = require('./gameTimeService');
const pvpWarService = require('./pvpWarService');
const cityService = require('./cityService');
const kingDasikongRankingService = require('./kingDasikongRankingService');
const {
  getPositionSilverBonus,
  silverBonusQuotaUnits,
} = require('../../shared/utils/positionStipendBonuses.cjs');

const SEASON = 'san_1';
const MAX_CANDIDATES = 3;
/** 品阶数字越小越高；≤5 = 中郎将及以上 */
const MAX_VOTE_POSITION_LEVEL = 5;

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

function voteWeightFromSilverBonus(silverBonus) {
  return silverBonusQuotaUnits(silverBonus);
}

function footprintCenter(fp) {
  const w = Number(fp.widthCells) || 2;
  const h = Number(fp.heightCells) || 2;
  return {
    cx: Number(fp.anchorGx) + w / 2,
    cy: Number(fp.anchorGy) + h / 2,
  };
}

function manhattan(a, b) {
  return Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
}

/**
 * @param {string} factionId
 * @returns {Promise<Array<{
 *   cityId: string, cityName: string, cityType: string, kind: 'pvp'|'pve',
 *   costSilver: number, costFood: number, dist: number
 * }>>}
 */
async function pickVoteCandidates(factionId) {
  const fid = String(factionId || '').trim();
  if (!fid) return [];

  const warSeason = SEASON;
  const { pvpTargets, pveTargets } = await aiKingActiveDecisionService.collectCandidateTargets(
    fid,
    warSeason,
  );
  const poolEligible = [
    ...(pvpTargets || [])
      .filter((c) => c._remonstranceMapRangeOk)
      .map((c) => ({ row: c, kind: 'pvp' })),
    ...(pveTargets || [])
      .filter((c) => c._remonstranceMapRangeOk)
      .map((c) => ({ row: c, kind: 'pve' })),
  ];
  if (!poolEligible.length) return [];

  const { footprints } = await strategicWarTargetProximityService.loadFootprintsAndCityByIdForSeason(
    warSeason,
  );
  const [ownRows] = await pool.query(
    `SELECT city_id FROM cities WHERE faction_id = ? AND position_x IS NOT NULL AND position_y IS NOT NULL`,
    [fid],
  );
  const ownIds = new Set((ownRows || []).map((r) => String(r.city_id)));
  const ownCenters = [];
  for (const fp of footprints || []) {
    const cid = String(fp.cityId || '').trim();
    if (ownIds.has(cid)) ownCenters.push(footprintCenter(fp));
  }
  if (!ownCenters.length) return [];

  const fpById = {};
  for (const fp of footprints || []) {
    const cid = String(fp.cityId || '').trim();
    if (cid) fpById[cid] = fp;
  }

  let gameTime = null;
  try {
    gameTime = await gameTimeService.loadGameTimeForFaction(fid);
  } catch {
    gameTime = null;
  }
  const bal = await factionReserveService.getPoolBalance(pool, fid);

  const scored = [];
  for (const { row, kind } of poolEligible) {
    const cityId = String(row.city_id || '').trim();
    if (!cityId) continue;
    const fp = fpById[cityId];
    if (!fp) continue;
    const center = footprintCenter(fp);
    let dist = Infinity;
    for (const o of ownCenters) {
      dist = Math.min(dist, manhattan(o, center));
    }
    let cost;
    try {
      cost = warInitiationCostService.computeScaledCostForCityType(row.city_type, gameTime);
    } catch {
      continue;
    }
    if ((bal.silver || 0) < cost.silver || (bal.food || 0) < cost.food) continue;
    scored.push({
      cityId,
      cityName: row.city_name || cityId,
      cityType: row.city_type || null,
      kind,
      costSilver: cost.silver,
      costFood: cost.food,
      dist,
    });
  }

  scored.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    return a.cityId.localeCompare(b.cityId);
  });
  return scored.slice(0, MAX_CANDIDATES);
}

async function getPollByFactionDate(connection, factionId, pollDateYmd) {
  const [rows] = await connection.query(
    `SELECT * FROM faction_war_daily_polls WHERE faction_id = ? AND poll_date = ? LIMIT 1`,
    [factionId, pollDateYmd],
  );
  return rows[0] || null;
}

function parseCandidates(json) {
  if (Array.isArray(json)) return json;
  if (typeof json === 'string') {
    try {
      const v = JSON.parse(json);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * 开今日票（单势力）
 */
async function openPollForFaction(factionId, king) {
  const fid = String(factionId || '').trim();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const todayYmd = await kingDasikongRankingService.getServerDateYmd(connection);
    const existing = await getPollByFactionDate(connection, fid, todayYmd);
    if (existing) {
      await connection.rollback();
      return { ok: true, factionId: fid, skipped: true, reason: 'already_opened', pollId: existing.id };
    }

    const load = await warConcurrencyService.getAttackerFactionWarLoad(fid, { season: SEASON });
    if (load.atCap) {
      await connection.query(
        `INSERT INTO faction_war_daily_polls
          (faction_id, poll_date, season, status, candidates_json, skip_reason)
         VALUES (?, ?, ?, 'skipped', JSON_ARRAY(), ?)`,
        [fid, todayYmd, SEASON, 'at_war_cap'],
      );
      await connection.commit();
      return { ok: true, factionId: fid, skipped: true, reason: 'at_war_cap' };
    }

    const candidates = await pickVoteCandidates(fid);
    if (!candidates.length) {
      await connection.query(
        `INSERT INTO faction_war_daily_polls
          (faction_id, poll_date, season, status, candidates_json, skip_reason)
         VALUES (?, ?, ?, 'skipped', JSON_ARRAY(), ?)`,
        [fid, todayYmd, SEASON, 'no_affordable_candidates'],
      );
      await connection.commit();
      return { ok: true, factionId: fid, skipped: true, reason: 'no_affordable_candidates' };
    }

    const slim = candidates.map((c) => ({
      cityId: c.cityId,
      cityName: c.cityName,
      cityType: c.cityType,
      kind: c.kind,
      costSilver: c.costSilver,
      costFood: c.costFood,
    }));
    const [ins] = await connection.query(
      `INSERT INTO faction_war_daily_polls
        (faction_id, poll_date, season, status, candidates_json)
       VALUES (?, ?, ?, 'open', ?)`,
      [fid, todayYmd, SEASON, JSON.stringify(slim)],
    );
    await connection.commit();
    console.log(
      `[warVote] open faction=${fid} poll=${ins.insertId} candidates=${slim.map((c) => c.cityId).join(',')}`,
    );
    return { ok: true, factionId: fid, pollId: ins.insertId, candidates: slim };
  } catch (e) {
    await connection.rollback();
    console.error(`[warVote] open failed faction=${fid}:`, e?.message || e);
    return { ok: false, factionId: fid, error: e.message || String(e) };
  } finally {
    connection.release();
  }
}

function pickWinnerFromTallies(candidates, tallies, rng = Math.random) {
  const ids = candidates.map((c) => c.cityId);
  let bestScore = -1;
  const tied = [];
  for (const id of ids) {
    const s = Number(tallies[id]) || 0;
    if (s > bestScore) {
      bestScore = s;
      tied.length = 0;
      tied.push(id);
    } else if (s === bestScore) {
      tied.push(id);
    }
  }
  // 无人投票：全部 0 分 → tied = 全部候选，随机
  const pick = tied[Math.floor(rng() * tied.length)] || ids[0];
  return { cityId: pick, score: bestScore, tied: tied.length > 1 || bestScore === 0 };
}

/**
 * 结票并开战
 */
async function resolvePollRow(poll) {
  const connection = await pool.getConnection();
  const pollId = poll.id;
  const fid = poll.faction_id;
  try {
    await connection.beginTransaction();
    const [locked] = await connection.query(
      `SELECT * FROM faction_war_daily_polls WHERE id = ? FOR UPDATE`,
      [pollId],
    );
    const row = locked[0];
    if (!row || row.status !== 'open') {
      await connection.rollback();
      return { ok: true, skipped: true, reason: 'not_open' };
    }

    const candidates = parseCandidates(row.candidates_json);
    if (!candidates.length) {
      await connection.query(
        `UPDATE faction_war_daily_polls
         SET status='skipped', skip_reason='empty_candidates', resolved_at=NOW() WHERE id=?`,
        [pollId],
      );
      await connection.commit();
      return { ok: true, skipped: true, reason: 'empty_candidates' };
    }

    const load = await warConcurrencyService.getAttackerFactionWarLoad(fid, { season: SEASON });
    if (load.atCap) {
      await connection.query(
        `UPDATE faction_war_daily_polls
         SET status='skipped', skip_reason='at_war_cap_on_resolve', resolved_at=NOW() WHERE id=?`,
        [pollId],
      );
      await connection.commit();
      return { ok: true, skipped: true, reason: 'at_war_cap_on_resolve' };
    }

    const [ballots] = await connection.query(
      `SELECT city_id, SUM(weight) AS w FROM faction_war_vote_ballots WHERE poll_id = ? GROUP BY city_id`,
      [pollId],
    );
    const tallies = {};
    for (const c of candidates) tallies[c.cityId] = 0;
    for (const b of ballots || []) {
      tallies[String(b.city_id)] = Number(b.w) || 0;
    }

    const { cityId: winnerId } = pickWinnerFromTallies(candidates, tallies);
    const winner = candidates.find((c) => c.cityId === winnerId) || candidates[0];

    // 结票事务先标记 resolved，开战在 commit 后执行（开战服务自管事务）
    await connection.query(
      `UPDATE faction_war_daily_polls
       SET status='resolved', winner_city_id=?, winner_kind=?, resolved_at=NOW()
       WHERE id=?`,
      [winner.cityId, winner.kind, pollId],
    );
    await connection.commit();
  } catch (e) {
    await connection.rollback();
    console.error(`[warVote] resolve lock failed poll=${pollId}:`, e?.message || e);
    return { ok: false, error: e.message || String(e) };
  } finally {
    connection.release();
  }

  // 重新读 winner 并开战
  const [rows] = await pool.query(`SELECT * FROM faction_war_daily_polls WHERE id = ?`, [pollId]);
  const resolved = rows[0];
  if (!resolved || resolved.status !== 'resolved') {
    return { ok: true, skipped: true, reason: 'status_changed' };
  }
  const candidates = parseCandidates(resolved.candidates_json);
  const winner =
    candidates.find((c) => c.cityId === resolved.winner_city_id) ||
    candidates[0];
  if (!winner) {
    return { ok: false, error: 'winner_missing' };
  }

  const king = aiKingConfigService.getKingByFactionId(fid);
  const kingName = king?.characterName || '君主';

  try {
    let resultWarId = null;
    if (winner.kind === 'pve') {
      const opened = await cityService.openPveWarOnNeutralCity(winner.cityId, {
        openedByCharacterId: king?.characterId || null,
        bulletinFactionId: fid,
      });
      resultWarId = opened.warId || null;
    } else {
      const war = await pvpWarService.createPvpWarDraftAndActivate({
        season: SEASON,
        attackerFactionId: fid,
        targetCityId: winner.cityId,
        warName: `${winner.cityName}之战（臣僚公议）`,
        proposer: {
          kind: 'ai_king_vote',
          displayName: kingName,
          playerId: null,
        },
      });
      resultWarId = war.pvpWarId || null;
    }
    await pool.query(`UPDATE faction_war_daily_polls SET result_war_id = ? WHERE id = ?`, [
      resultWarId,
      pollId,
    ]);
    console.log(
      `[warVote] resolved faction=${fid} winner=${winner.cityId} kind=${winner.kind} war=${resultWarId}`,
    );
    return { ok: true, factionId: fid, winner, resultWarId };
  } catch (e) {
    console.error(`[warVote] open war failed poll=${pollId}:`, e?.message || e);
    await pool.query(
      `UPDATE faction_war_daily_polls SET skip_reason = ? WHERE id = ?`,
      [String(e.message || e).slice(0, 250), pollId],
    );
    return { ok: false, factionId: fid, error: e.message || String(e), winner };
  }
}

async function resolveStaleOpenPolls() {
  const conn = await pool.getConnection();
  let todayYmd;
  let rows;
  try {
    todayYmd = await kingDasikongRankingService.getServerDateYmd(conn);
    const [r] = await conn.query(
      `SELECT * FROM faction_war_daily_polls
       WHERE status = 'open' AND poll_date < ?`,
      [todayYmd],
    );
    rows = r || [];
  } finally {
    conn.release();
  }

  const results = [];
  for (const poll of rows) {
    results.push(await resolvePollRow(poll));
  }
  return { ok: true, todayYmd, results };
}

async function openPollsForAllKings() {
  const kings = aiKingConfigService.listAllKings();
  const results = [];
  for (const king of kings) {
    results.push(await openPollForFaction(king.factionId, king));
  }
  return { ok: true, results };
}

/**
 * 00:00 / 启动补跑入口：先结昨日票，再开今日票
 */
async function runDailyTick(opts = {}) {
  const onlyFaction = opts.factionId != null ? String(opts.factionId).trim() : '';
  const resolvePart = await resolveStaleOpenPolls();
  let openPart;
  if (onlyFaction) {
    const king = aiKingConfigService.getKingByFactionId(onlyFaction);
    openPart = {
      ok: true,
      results: [await openPollForFaction(onlyFaction, king)],
    };
  } else {
    openPart = await openPollsForAllKings();
  }
  return { ok: true, resolve: resolvePart, open: openPart };
}

async function runStaleCatchUpOnStartup() {
  return runDailyTick();
}

/**
 * 面板数据
 */
async function getVotePanelForPlayer(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少玩家' };

  const [pRows] = await pool.query(
    `SELECT p.player_id, p.faction_id, p.position_level, p.current_position_id, p.character_name,
            cp.position_bonuses, cp.position_name
     FROM players p
     LEFT JOIN config_positions cp ON cp.position_id = p.current_position_id
     WHERE p.player_id = ? LIMIT 1`,
    [pid],
  );
  if (!pRows[0]) return { ok: false, status: 404, error: '玩家不存在' };
  const pl = pRows[0];
  const fid = pl.faction_id ? String(pl.faction_id).trim() : '';
  if (!fid || !aiKingConfigService.hasKingForFaction(fid)) {
    return {
      ok: true,
      data: {
        available: false,
        reason: 'no_ai_king_faction',
        poll: null,
      },
    };
  }

  const conn = await pool.getConnection();
  let todayYmd;
  let poll;
  try {
    todayYmd = await kingDasikongRankingService.getServerDateYmd(conn);
    poll = await getPollByFactionDate(conn, fid, todayYmd);
  } finally {
    conn.release();
  }

  if (!poll || poll.status === 'skipped') {
    return {
      ok: true,
      data: {
        available: false,
        reason: poll?.skip_reason || 'no_poll_today',
        pollDate: todayYmd,
        poll: poll
          ? {
              status: poll.status,
              skipReason: poll.skip_reason,
            }
          : null,
      },
    };
  }

  const candidates = parseCandidates(poll.candidates_json);
  const [ballots] = await pool.query(
    `SELECT city_id, SUM(weight) AS w, COUNT(*) AS voters
     FROM faction_war_vote_ballots WHERE poll_id = ? GROUP BY city_id`,
    [poll.id],
  );
  const tallyByCity = {};
  for (const c of candidates) {
    tallyByCity[c.cityId] = { score: 0, voters: 0 };
  }
  for (const b of ballots || []) {
    const id = String(b.city_id);
    tallyByCity[id] = { score: Number(b.w) || 0, voters: Number(b.voters) || 0 };
  }

  const [myBallot] = await pool.query(
    `SELECT city_id, weight FROM faction_war_vote_ballots WHERE poll_id = ? AND player_id = ? LIMIT 1`,
    [poll.id, pid],
  );

  const level = pl.position_level == null ? null : Number(pl.position_level);
  const silverBonus = getPositionSilverBonus(pl.position_bonuses);
  const weight = voteWeightFromSilverBonus(silverBonus);
  const canVote =
    poll.status === 'open' &&
    level != null &&
    level <= MAX_VOTE_POSITION_LEVEL &&
    weight >= 1;

  let blockReason = null;
  if (poll.status !== 'open') blockReason = '今日投票已结束';
  else if (level == null || level > MAX_VOTE_POSITION_LEVEL) {
    blockReason = '需五品（中郎将）及以上官职方可投票';
  } else if (weight < 1) blockReason = '官职银两加成不足，无投票权重';

  return {
    ok: true,
    data: {
      available: true,
      pollDate: todayYmd,
      poll: {
        id: poll.id,
        status: poll.status,
        candidates: candidates.map((c) => ({
          ...c,
          score: tallyByCity[c.cityId]?.score || 0,
          voters: tallyByCity[c.cityId]?.voters || 0,
        })),
        winnerCityId: poll.winner_city_id,
        resultWarId: poll.result_war_id,
        myVoteCityId: myBallot[0]?.city_id || null,
        myWeight: myBallot[0] ? Number(myBallot[0].weight) : weight,
        canVote,
        blockReason,
        voteWeight: weight,
        positionLevel: level,
        positionName: pl.position_name || null,
        silverBonus,
        rulesHint:
          '五品及以上可投；权重=签到银加成÷10。次日 00:00 按总分开战；平票或无人投票则随机择一。',
      },
    },
  };
}

/**
 * 投票（可改投）
 */
async function castVote(playerId, cityId) {
  const pid = String(playerId || '').trim();
  const cid = String(cityId || '').trim();
  if (!pid || !cid) return { ok: false, status: 400, error: '缺少参数' };

  const panel = await getVotePanelForPlayer(pid);
  if (!panel.ok) return panel;
  const poll = panel.data?.poll;
  if (!panel.data?.available || !poll || poll.status !== 'open') {
    return { ok: false, status: 400, error: panel.data?.reason || '今日无开放投票' };
  }
  if (!poll.canVote) {
    return { ok: false, status: 400, error: poll.blockReason || '不可投票' };
  }
  if (!poll.candidates.some((c) => c.cityId === cid)) {
    return { ok: false, status: 400, error: '候选城无效' };
  }

  const weight = Number(poll.voteWeight) || 0;
  await pool.query(
    `INSERT INTO faction_war_vote_ballots (poll_id, player_id, city_id, weight, voted_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE city_id = VALUES(city_id), weight = VALUES(weight), voted_at = NOW()`,
    [poll.id, pid, cid, weight],
  );

  return getVotePanelForPlayer(pid);
}

module.exports = {
  runDailyTick,
  runStaleCatchUpOnStartup,
  openPollForFaction,
  resolveStaleOpenPolls,
  getVotePanelForPlayer,
  castVote,
  pickVoteCandidates,
  voteWeightFromSilverBonus,
  MAX_VOTE_POSITION_LEVEL,
  MAX_CANDIDATES,
};
