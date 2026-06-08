/**
 * 真三日报 · 00:00 digest 生成（32-6 §4 / §5 / §9）
 * 须在 resetFactionBaselines 之前 pickDailyWinner（cron 注册顺序先于大司空 tick）。
 */

const { pool } = require('../database/connection');
const kingDasikongRankingService = require('./kingDasikongRankingService');
const { EVENT_ID } = require('../config/kingDasikongDaily');
const { resolveFactionDisplayName } = require('./factionDisplayName');
const factionReserveService = require('./factionReserveService');
const { SAN_1_PLAYABLE_FACTION_IDS } = require('../../shared/utils/san1PlayableFactions.cjs');
const { mysqlDateToYmd } = require('./dailyReportDigestReadService');

const CITY_TYPES_FOR_COUNT = ['city_major', 'city_medium', 'city_small'];
const MAJOR_MEDIUM_TYPES = ['city_major', 'city_medium'];
const WAR_HOTSPOT_LIMIT = 5;
const BULLETIN_EXCERPT_MAX = 60;

const REGION_WEIGHT = { east_asia: 0, asia: 1, europe: 2, other: 3 };

function stripBulletinTimestamp(body) {
  return String(body || '').replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]\s*/, '');
}

function truncateExcerpt(text, maxLen = BULLETIN_EXCERPT_MAX) {
  const t = String(text || '').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function formatWarLabel(cityName, warName) {
  const cn = String(cityName || '').trim();
  if (cn) return cn.endsWith('之战') ? cn : `${cn}之战`;
  const wn = String(warName || '').trim();
  if (wn) return wn.includes('之战') ? wn : `${wn}之战`;
  return '未知战事';
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function listDigestServerIds(connection) {
  try {
    const [rows] = await connection.query(
      `SELECT DISTINCT COALESCE(NULLIF(TRIM(serverId), ''), 'default') AS sid
       FROM accounts WHERE status = 'active'`,
    );
    const ids = [...new Set((rows || []).map((r) => String(r.sid || 'default').trim() || 'default'))];
    return ids.length ? ids : ['default'];
  } catch (e) {
    if (/Unknown column/i.test(e?.message || '')) {
      return ['default'];
    }
    throw e;
  }
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} serverId
 * @param {string} digestDateYmd
 */
async function loadPreviousDigestPayload(connection, serverId, digestDateYmd) {
  const [dr] = await connection.query('SELECT DATE_SUB(?, INTERVAL 1 DAY) AS d', [digestDateYmd]);
  const prevDate = mysqlDateToYmd(dr[0]?.d);
  if (!prevDate) return null;
  const [rows] = await connection.query(
    `SELECT payload_json FROM daily_report_digests
     WHERE digest_date = ? AND server_id = ? LIMIT 1`,
    [prevDate, serverId],
  );
  const raw = rows[0]?.payload_json;
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function loadFactionCityCounts(connection) {
  const placeholders = CITY_TYPES_FOR_COUNT.map(() => '?').join(',');
  const [rows] = await connection.query(
    `SELECT faction_id AS factionId, COUNT(*) AS cityCount
     FROM cities
     WHERE status = 'owned'
       AND city_type IN (${placeholders})
       AND faction_id IS NOT NULL
     GROUP BY faction_id`,
    CITY_TYPES_FOR_COUNT,
  );
  /** @type {Record<string, number>} */
  const out = {};
  for (const row of rows || []) {
    const fid = String(row.factionId || '').trim();
    if (fid) out[fid] = Number(row.cityCount) || 0;
  }
  return out;
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function loadMajorMediumOwnership(connection) {
  const placeholders = MAJOR_MEDIUM_TYPES.map(() => '?').join(',');
  const [rows] = await connection.query(
    `SELECT city_id AS cityId, city_name AS cityName, faction_id AS factionId, city_type AS cityType
     FROM cities
     WHERE status = 'owned' AND city_type IN (${placeholders})`,
    MAJOR_MEDIUM_TYPES,
  );
  /** @type {Record<string, string>} */
  const ownership = {};
  /** @type {Record<string, { cityName: string, cityType: string }>} */
  const meta = {};
  for (const row of rows || []) {
    const cid = String(row.cityId || '').trim();
    const fid = String(row.factionId || '').trim();
    if (!cid) continue;
    ownership[cid] = fid || '';
    meta[cid] = { cityName: row.cityName || cid, cityType: row.cityType || '' };
  }
  return { ownership, meta };
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} digestDateYmd
 */
async function loadWarHotspots(connection, digestDateYmd) {
  const [rows] = await connection.query(
    `SELECT
       COALESCE(b.pvp_war_id, b.war_id) AS warKey,
       MAX(b.pvp_war_id) AS pvpWarId,
       MAX(b.war_id) AS pveWarId,
       COUNT(*) AS battleCount
     FROM battles b
     WHERE DATE(b.battle_at) = ?
       AND COALESCE(b.pvp_war_id, b.war_id) IS NOT NULL
     GROUP BY warKey
     ORDER BY battleCount DESC, warKey ASC
     LIMIT ?`,
    [digestDateYmd, WAR_HOTSPOT_LIMIT],
  );

  const hotspots = [];
  for (const r of rows || []) {
    let cityName = null;
    let warName = null;
    if (r.pvpWarId) {
      const [wp] = await connection.query(
        'SELECT target_city_name AS cityName, war_name AS warName FROM wars_pvp WHERE pvp_war_id = ? LIMIT 1',
        [r.pvpWarId],
      );
      cityName = wp[0]?.cityName;
      warName = wp[0]?.warName;
    } else if (r.pveWarId) {
      const [w] = await connection.query(
        'SELECT target_city_name AS cityName, war_name AS warName FROM wars WHERE war_id = ? LIMIT 1',
        [r.pveWarId],
      );
      cityName = w[0]?.cityName;
      warName = w[0]?.warName;
    }
    hotspots.push({
      warKey: r.warKey,
      label: formatWarLabel(cityName, warName),
      battleCount: Number(r.battleCount) || 0,
    });
  }
  return hotspots;
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} digestDateYmd
 */
async function loadBattleTotals(connection, digestDateYmd) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total FROM battles WHERE DATE(battle_at) = ?`,
    [digestDateYmd],
  );
  return Number(rows[0]?.total) || 0;
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} digestDateYmd
 */
async function loadLongestBulletin(connection, digestDateYmd) {
  const [rows] = await connection.query(
    `SELECT fb.id, fb.category, fb.body, fb.author_name AS authorName,
            fb.faction_id AS factionId
     FROM faction_bulletins fb
     WHERE fb.category IN ('edict', 'document')
       AND DATE(fb.created_at) = ?`,
    [digestDateYmd],
  );
  if (!rows?.length) return null;

  let bestRow = null;
  let bestLen = -1;
  for (const row of rows) {
    const plainLen = stripBulletinTimestamp(row.body).length;
    if (plainLen > bestLen || (plainLen === bestLen && Number(row.id) > Number(bestRow?.id || 0))) {
      bestLen = plainLen;
      bestRow = row;
    }
  }
  if (!bestRow) return null;

  const bodyPlain = stripBulletinTimestamp(bestRow.body);
  const factionName = (await resolveFactionDisplayName(bestRow.factionId, connection)) || bestRow.factionId;
  const categoryLabel = bestRow.category === 'document' ? '文书' : '谕旨';

  return {
    id: bestRow.id,
    factionId: bestRow.factionId,
    factionName,
    category: bestRow.category,
    categoryLabel,
    authorName: bestRow.authorName || null,
    text: truncateExcerpt(bodyPlain),
    bodyLength: bodyPlain.length,
  };
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function loadDailyActivityWinners(connection) {
  const winners = [];
  for (const factionId of SAN_1_PLAYABLE_FACTION_IDS) {
    const winner = await kingDasikongRankingService.pickDailyWinner(connection, factionId, EVENT_ID);
    if (!winner?.playerId) continue;
    const factionName = (await resolveFactionDisplayName(factionId, connection)) || factionId;
    winners.push({
      factionId,
      factionName,
      playerId: winner.playerId,
      characterName: winner.characterName,
      totalScore: Math.max(0, Math.floor(Number(winner.totalScore) || 0)),
    });
  }
  return winners;
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function loadRichestFaction(connection) {
  let best = null;
  for (const factionId of SAN_1_PLAYABLE_FACTION_IDS) {
    const bal = await factionReserveService.getPoolBalance(connection, factionId);
    const silver = Number(bal?.silver) || 0;
    const food = Number(bal?.food) || 0;
    const total = silver + food;
    if (!best || total > best.totalReserve) {
      const factionName = (await resolveFactionDisplayName(factionId, connection)) || factionId;
      best = { factionId, factionName, silver, food, totalReserve: total };
    }
  }
  return best;
}

/**
 * @param {object} params
 */
function composeSections(params) {
  const {
    factionCityCounts,
    prevFactionCityCounts,
    majorMediumOwnership,
    prevMajorMediumOwnership,
    majorMediumMeta,
    dailyActivityWinners,
    richestFaction,
    bulletinExcerpt,
    battleTotals,
    prevBattleTotal,
  } = params;

  /** @type {Array<{ type: string, title?: string, lines: string[] }>} */
  const sections = [];

  // A · 占城变化
  const cityLines = [];
  for (const factionId of SAN_1_PLAYABLE_FACTION_IDS) {
    const cur = Number(factionCityCounts[factionId]) || 0;
    const prev = Number(prevFactionCityCounts?.[factionId]) || 0;
    const delta = cur - prev;
    if (delta === 0) continue;
    const name = params.factionNames?.[factionId] || factionId;
    if (delta > 0) {
      cityLines.push(`${name}昨日扩土 ${delta} 城，兵锋正盛。`);
    } else {
      cityLines.push(`${name}昨日失地 ${Math.abs(delta)} 城，形势吃紧。`);
    }
  }

  const prevOwn = prevMajorMediumOwnership || {};
  const curOwn = majorMediumOwnership || {};
  const changedCityIds = new Set();
  for (const cid of new Set([...Object.keys(prevOwn), ...Object.keys(curOwn)])) {
    if ((prevOwn[cid] || '') !== (curOwn[cid] || '')) changedCityIds.add(cid);
  }
  for (const cid of changedCityIds) {
    const meta = majorMediumMeta?.[cid];
    if (!meta) continue;
    const newFactionId = curOwn[cid];
    if (!newFactionId) continue;
    const fname = params.factionNames?.[newFactionId] || newFactionId;
    const cname = meta.cityName || cid;
    cityLines.push(`${fname}昨日克 ${cname}。`);
  }
  if (cityLines.length) {
    sections.push({ type: 'city_delta', title: '占城风云', lines: cityLines });
  }

  // B · 日活跃榜第一
  const rankLines = (dailyActivityWinners || []).map(
    (w) =>
      `${w.factionName}昨日群臣之中，${w.characterName} 日活跃 ${w.totalScore} 分，独占鳌头。`,
  );
  if (rankLines.length) {
    sections.push({ type: 'daily_activity', title: '日活跃魁首', lines: rankLines });
  }

  // C · 储备最富
  if (richestFaction?.factionName) {
    sections.push({
      type: 'richest_reserve',
      title: '储备丰饶',
      lines: [
        `${richestFaction.factionName}银粮合计最为丰厚（银 ${richestFaction.silver}、粮 ${richestFaction.food}），国库充盈。`,
      ],
    });
  }

  // E · 公告节选
  if (bulletinExcerpt?.text) {
    const who = bulletinExcerpt.authorName ? `${bulletinExcerpt.authorName}：` : '';
    sections.push({
      type: 'bulletin_excerpt',
      title: '谕旨文书',
      lines: [
        `【${bulletinExcerpt.factionName}·${bulletinExcerpt.categoryLabel}】${who}${bulletinExcerpt.text}`,
      ],
    });
  }

  // F · 全服战斗场次
  const total = Number(battleTotals) || 0;
  const prev = Number(prevBattleTotal);
  if (total > 0 || prev > 0) {
    let line = `昨日全服共 ${total} 场战斗`;
    if (Number.isFinite(prev)) {
      const delta = total - prev;
      if (delta > 0) line += `，较前日增 ${delta} 场。`;
      else if (delta < 0) line += `，较前日减 ${Math.abs(delta)} 场。`;
      else line += '，与前日持平。';
    } else {
      line += '。';
    }
    sections.push({ type: 'battle_totals', title: '烽烟统计', lines: [line] });
  }

  return sections;
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} serverId
 * @param {string} digestDateYmd
 * @param {{ force?: boolean }} [opts]
 */
async function composeAndPersistDigest(connection, serverId, digestDateYmd, opts = {}) {
  const sid = String(serverId || 'default').trim() || 'default';
  const dateYmd = String(digestDateYmd || '').slice(0, 10);
  if (!dateYmd) return { ok: false, error: 'invalid digest date' };

  if (!opts.force) {
    const [exists] = await connection.query(
      `SELECT 1 FROM daily_report_digests WHERE digest_date = ? AND server_id = ? LIMIT 1`,
      [dateYmd, sid],
    );
    if (exists.length) {
      return { ok: true, skipped: true, serverId: sid, digestDate: dateYmd };
    }
  }

  const prevPayload = await loadPreviousDigestPayload(connection, sid, dateYmd);
  const factionCityCounts = await loadFactionCityCounts(connection);
  const { ownership: majorMediumOwnership, meta: majorMediumMeta } =
    await loadMajorMediumOwnership(connection);
  const dailyActivityWinners = await loadDailyActivityWinners(connection);
  const richestFaction = await loadRichestFaction(connection);
  const bulletinExcerpt = await loadLongestBulletin(connection, dateYmd);
  const warHotspots = await loadWarHotspots(connection, dateYmd);
  const battleTotals = await loadBattleTotals(connection, dateYmd);
  const prevBattleTotal = Number(prevPayload?.battleTotals?.total);
  const prevFactionCityCounts = prevPayload?.factionCityCounts || null;
  const prevMajorMediumOwnership = prevPayload?.majorMediumOwnership || null;

  /** @type {Record<string, string>} */
  const factionNames = {};
  for (const factionId of SAN_1_PLAYABLE_FACTION_IDS) {
    factionNames[factionId] = (await resolveFactionDisplayName(factionId, connection)) || factionId;
  }

  const sections = composeSections({
    factionCityCounts,
    prevFactionCityCounts,
    majorMediumOwnership,
    prevMajorMediumOwnership,
    majorMediumMeta,
    dailyActivityWinners,
    richestFaction,
    bulletinExcerpt,
    battleTotals,
    prevBattleTotal: Number.isFinite(prevBattleTotal) ? prevBattleTotal : null,
    factionNames,
  });

  const payload = {
    sections,
    warHotspots,
    bulletinExcerpt: bulletinExcerpt || null,
    battleTotals: {
      total: battleTotals,
      prevTotal: Number.isFinite(prevBattleTotal) ? prevBattleTotal : null,
      delta: Number.isFinite(prevBattleTotal) ? battleTotals - prevBattleTotal : null,
    },
    factionCityCounts,
    majorMediumOwnership,
    dailyActivityWinners,
    richestFaction: richestFaction || null,
  };

  await connection.query(
    `INSERT INTO daily_report_digests (digest_date, server_id, payload_json)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), created_at = CURRENT_TIMESTAMP`,
    [dateYmd, sid, JSON.stringify(payload)],
  );

  return {
    ok: true,
    serverId: sid,
    digestDate: dateYmd,
    sectionCount: sections.length,
    warHotspotCount: warHotspots.length,
  };
}

/**
 * 00:00 cron：为「昨日」各分服写入 digest
 * @param {{ digestDateYmd?: string, force?: boolean, serverId?: string }} [opts]
 */
async function runDailyDigestTick(opts = {}) {
  const connection = await pool.getConnection();
  try {
    let digestDateYmd = opts.digestDateYmd;
    if (!digestDateYmd) {
      const [dr] = await connection.query('SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY) AS y');
      digestDateYmd = mysqlDateToYmd(dr[0]?.y);
    }
    if (!digestDateYmd) return { ok: false, error: 'cannot resolve yesterday' };

    const serverIds = opts.serverId
      ? [String(opts.serverId).trim() || 'default']
      : await listDigestServerIds(connection);

    const results = [];
    for (const sid of serverIds) {
      results.push(
        await composeAndPersistDigest(connection, sid, digestDateYmd, { force: !!opts.force }),
      );
    }

    const applied = results.filter((r) => r.ok && !r.skipped);
    console.log(
      `[dailyReport] digest tick date=${digestDateYmd} applied=${applied.length} skipped=${results.length - applied.length}`,
    );
    return { ok: true, digestDate: digestDateYmd, results };
  } catch (e) {
    console.error('[dailyReport] digest tick failed:', e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  } finally {
    connection.release();
  }
}

/**
 * 启动补跑：若昨日 digest 缺失则生成（漏跑 0:00 时自愈）
 */
async function runStaleCatchUpOnStartup() {
  const connection = await pool.getConnection();
  try {
    const [dr] = await connection.query('SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY) AS y');
    const yesterday = mysqlDateToYmd(dr[0]?.y);
    if (!yesterday) return { ok: true, skipped: true, reason: 'no_yesterday' };

    const serverIds = await listDigestServerIds(connection);
    const missing = [];
    for (const sid of serverIds) {
      const [rows] = await connection.query(
        `SELECT 1 FROM daily_report_digests WHERE digest_date = ? AND server_id = ? LIMIT 1`,
        [yesterday, sid],
      );
      if (!rows.length) missing.push(sid);
    }
    if (!missing.length) return { ok: true, skipped: true, reason: 'digest_exists' };

    console.warn(`[dailyReport] startup catch-up digest=${yesterday} servers=${missing.join(',')}`);
    const results = [];
    for (const sid of missing) {
      results.push(await composeAndPersistDigest(connection, sid, yesterday, { force: false }));
    }
    return { ok: true, digestDate: yesterday, results };
  } catch (e) {
    if (/doesn't exist|Unknown table/i.test(e?.message || '')) {
      return { ok: false, error: 'missing_daily_report_digests_table' };
    }
    console.error('[dailyReport] startup catch-up failed:', e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  } finally {
    connection.release();
  }
}

module.exports = {
  runDailyDigestTick,
  runStaleCatchUpOnStartup,
  composeAndPersistDigest,
  BULLETIN_EXCERPT_MAX,
  REGION_WEIGHT,
};
