/**
 * 势力公告流水
 * - 大地图「势力」Tab：战事摘要（category=war）
 * - 三公府「公告」象限：谕旨 edict / 文书 document / 战事 war
 *
 * 表：`faction_bulletins`（见 migrations/create-faction-bulletins.sql、add-faction-bulletins-category.sql）
 */

const { pool } = require('../database/connection');

const CATEGORY = {
  EDICT: 'edict',
  DOCUMENT: 'document',
  WAR: 'war',
};

/** 势力 Tab 公告 · 谕旨 / 文书 / 战事：仅保留最近 3 天（墙钟）；外交等其它类目不受限 */
const BULLETIN_RETENTION_DAYS = 3;
const BULLETIN_RETENTION_MS = BULLETIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const RETENTION_CATEGORIES = new Set([
  CATEGORY.EDICT,
  CATEGORY.DOCUMENT,
  CATEGORY.WAR,
]);

function retentionCutoffDate(nowMs = Date.now()) {
  return new Date(nowMs - BULLETIN_RETENTION_MS);
}

function categoryUsesRetention(category) {
  return category != null && RETENTION_CATEGORIES.has(category);
}

function formatTimestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} db
 * @param {string} factionId
 * @param {string} textWithoutBracket
 * @param {{ category?: string, authorPlayerId?: string|null, authorName?: string|null }} [opts]
 * @returns {Promise<number>} insert id
 */
async function appendOnConnection(db, factionId, textWithoutBracket, opts = {}) {
  if (!factionId || typeof textWithoutBracket !== 'string') return 0;
  const category = opts.category || CATEGORY.WAR;
  const body = `[${formatTimestamp()}] ${textWithoutBracket}`.slice(0, 512);
  const [result] = await db.query(
    `INSERT INTO faction_bulletins (faction_id, category, body, author_player_id, author_name)
     VALUES (?, ?, ?, ?, ?)`,
    [
      factionId,
      category,
      body,
      opts.authorPlayerId || null,
      opts.authorName || null,
    ],
  );
  return Number(result.insertId) || 0;
}

/**
 * @param {string} factionId
 * @param {string} textWithoutBracket
 * @param {{ category?: string, authorPlayerId?: string|null, authorName?: string|null }} [opts]
 */
async function append(factionId, textWithoutBracket, opts = {}) {
  return appendOnConnection(pool, factionId, textWithoutBracket, opts);
}

function appendSafe(factionId, textWithoutBracket, opts = {}) {
  append(factionId, textWithoutBracket, opts).catch((err) => {
    console.error('[factionBulletin] append failed:', factionId, err.message);
  });
}

function mapRow(r) {
  return {
    id: Number(r.id),
    category: r.category || CATEGORY.WAR,
    body: r.body,
    authorPlayerId: r.authorPlayerId || r.author_player_id || null,
    authorName: r.authorName || r.author_name || null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  };
}

/**
 * 删除本势力下超过保留期的谕旨 / 文书 / 战事行（外交等类目不删）。
 *
 * @param {string} factionId
 */
async function purgeExpiredBulletinsForFaction(factionId) {
  if (!factionId) return 0;
  const cutoff = retentionCutoffDate();
  try {
    const [result] = await pool.query(
      `DELETE FROM faction_bulletins
       WHERE faction_id = ? AND category IN (?, ?, ?) AND created_at < ?`,
      [factionId, CATEGORY.EDICT, CATEGORY.DOCUMENT, CATEGORY.WAR, cutoff],
    );
    return Number(result.affectedRows) || 0;
  } catch (e) {
    if (/Unknown column ['`]category/i.test(e?.message || '')) {
      const [result] = await pool.query(
        'DELETE FROM faction_bulletins WHERE faction_id = ? AND created_at < ?',
        [factionId, cutoff],
      );
      return Number(result.affectedRows) || 0;
    }
    throw e;
  }
}

/**
 * @param {string} factionId
 * @param {{ limit?: number, category?: string|null }} [opts]
 */
async function listForFaction(factionId, opts = {}) {
  if (!factionId) return [];
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  const category = opts.category != null && String(opts.category).trim()
    ? String(opts.category).trim()
    : null;
  const retention = categoryUsesRetention(category);
  const cutoff = retention ? retentionCutoffDate() : null;

  let sql = `SELECT id, category, body, author_player_id AS authorPlayerId, author_name AS authorName,
                    created_at AS createdAt
             FROM faction_bulletins WHERE faction_id = ?`;
  const params = [factionId];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (retention && cutoff) {
    sql += ' AND created_at >= ?';
    params.push(cutoff);
  }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);

  try {
    const [rows] = await pool.query(sql, params);
    return rows.map(mapRow);
  } catch (e) {
    if (/Unknown column ['`]category/i.test(e?.message || '')) {
      let legacySql =
        'SELECT id, body, created_at AS createdAt FROM faction_bulletins WHERE faction_id = ?';
      const legacyParams = [factionId];
      if (retention && cutoff) {
        legacySql += ' AND created_at >= ?';
        legacyParams.push(cutoff);
      }
      legacySql += ' ORDER BY id DESC LIMIT ?';
      legacyParams.push(limit);
      const [rows] = await pool.query(legacySql, legacyParams);
      return rows.map((r) => mapRow({ ...r, category: CATEGORY.WAR }));
    }
    throw e;
  }
}

/**
 * @param {string} factionId
 * @param {{ limitPerCategory?: number }} [opts]
 */
async function listGroupedForFaction(factionId, opts = {}) {
  await purgeExpiredBulletinsForFaction(factionId);
  const limit = Math.min(50, Math.max(1, Number(opts.limitPerCategory) || 30));
  const [edicts, documents, wars] = await Promise.all([
    listForFaction(factionId, { limit, category: CATEGORY.EDICT }),
    listForFaction(factionId, { limit, category: CATEGORY.DOCUMENT }),
    listForFaction(factionId, { limit, category: CATEGORY.WAR }),
  ]);
  return { edicts, documents, wars };
}

/** AI 君主 · 每日大司空任命谕旨 */
function logDasikongEdict(factionId, kingName, winnerName, totalScore) {
  const king = String(kingName || '君主').trim();
  const winner = String(winnerName || '—').trim();
  const score = Math.max(0, Math.floor(Number(totalScore) || 0));
  appendSafe(
    factionId,
    `【谕旨】${king}：依昨日群臣功绩，册封 ${winner} 为大司空（日榜 ${score} 分）。`,
    { category: CATEGORY.EDICT },
  );
}

async function logPvpWarStarted(war) {
  const city = war.targetCityName || war.targetCityId || '目标城';
  let attName = war.attackerFactionName || null;
  if (war.attackerFactionId) {
    const resolved = await require('./factionDisplayName').resolveFactionDisplayName(war.attackerFactionId);
    if (resolved) attName = resolved;
  }
  if (!attName) attName = '敌军';
  appendSafe(war.attackerFactionId, `PVP 战事：我军向「${city}」进军，战事已开（攻方）。`, {
    category: CATEGORY.WAR,
  });
  appendSafe(war.defenderFactionId, `PVP 战事：「${attName}」进犯我方「${city}」，战事已开（守方）。`, {
    category: CATEGORY.WAR,
  });
}

function logPvpWarEnded(war, end) {
  const city = war.targetCityName || war.targetCityId || '目标城';
  const { status, winnerFactionId, endedByOfficial, cancelReason, neverActivated } = end;

  if (endedByOfficial) {
    const reason = cancelReason ? `（${String(cancelReason).slice(0, 80)}）` : '';
    appendSafe(
      war.attackerFactionId,
      `战事结束：由一品官职官员（position_level=1）主持结案，本场战事已止${reason}`,
      { category: CATEGORY.WAR },
    );
    appendSafe(
      war.defenderFactionId,
      `战事结束：由一品官职官员（position_level=1）主持结案，本场战事已止${reason}`,
      { category: CATEGORY.WAR },
    );
    return;
  }

  if (status === 'cancelled' && neverActivated) {
    appendSafe(
      war.attackerFactionId,
      `战事筹划已解除：针对「${city}」的进犯未落营开战，草案已撤销。`,
      { category: CATEGORY.WAR },
    );
    appendSafe(
      war.defenderFactionId,
      `战事筹划已解除：敌方针对「${city}」的进犯未正式开战，草案已撤销。`,
      { category: CATEGORY.WAR },
    );
    return;
  }

  if (status === 'cancelled') {
    const tail = cancelReason ? ` ${String(cancelReason).slice(0, 120)}` : '';
    appendSafe(war.attackerFactionId, `战事结束：本场已撤销/解除。${tail}`.trim(), {
      category: CATEGORY.WAR,
    });
    appendSafe(war.defenderFactionId, `战事结束：本场已撤销/解除。${tail}`.trim(), {
      category: CATEGORY.WAR,
    });
    return;
  }

  const att = war.attackerFactionId;
  const def = war.defenderFactionId;
  const win = winnerFactionId;

  if (status === 'completed' && win === att) {
    appendSafe(att, `战事结束：我军告捷，「${city}」战局已定（攻方胜利）。`, { category: CATEGORY.WAR });
    appendSafe(def, `战事结束：我军失利，「${city}」战局已定（守方失利）。`, { category: CATEGORY.WAR });
  } else if (status === 'completed' && win === def) {
    appendSafe(att, `战事结束：我军失利，「${city}」战局已定（守方固守/终局）。`, { category: CATEGORY.WAR });
    appendSafe(def, `战事结束：我军告捷，「${city}」战局已定（守方胜利）。`, { category: CATEGORY.WAR });
  } else if (status === 'failed' && win === def) {
    appendSafe(att, `战事结束：我军失利，「${city}」战局已定（大本营失守）。`, { category: CATEGORY.WAR });
    appendSafe(def, `战事结束：我军告捷，「${city}」战局已定（守方胜利）。`, { category: CATEGORY.WAR });
  } else {
    appendSafe(att, `战事结束：「${city}」战事已结案（${status || '—'}）。`, { category: CATEGORY.WAR });
    appendSafe(def, `战事结束：「${city}」战事已结案（${status || '—'}）。`, { category: CATEGORY.WAR });
  }
}

function logPveWarStarted(factionId, cityName, cityId) {
  const label = cityName || cityId || '中立城';
  appendSafe(factionId, `PVE 战事：我军对中立城「${label}」发起攻城，战事已开。`, { category: CATEGORY.WAR });
}

function logPveWarSiegeCompleted(winnerFactionId, cityName, cityId) {
  if (!winnerFactionId) return;
  const label = cityName || cityId || '城池';
  appendSafe(winnerFactionId, `PVE 战事结束：我军击破「${label}」守军，城池易主。`, { category: CATEGORY.WAR });
}

/**
 * 征发 AI 军团 · 前军 / 后军窗战果摘要（11-3 §5.5.2 · 不写 battles 表）。
 *
 * @param {{
 *   factionId: string,
 *   campLabel: string,
 *   cityName: string,
 *   outcome: 'good'|'poor',
 *   totalKills: number,
 *   battlesRun: number,
 *   stoppedEarly?: boolean,
 * }} payload
 */
function logConscriptAssaultSummary(payload) {
  const {
    factionId,
    campLabel = '征发军团',
    cityName = '目标城',
    outcome = 'poor',
    totalKills = 0,
    battlesRun = 0,
    stoppedEarly = false,
  } = payload || {};
  if (!factionId) return;
  const city = String(cityName || '目标城').trim();
  const kills = Math.max(0, Math.floor(Number(totalKills) || 0));
  const runs = Math.max(0, Math.floor(Number(battlesRun) || 0));
  if (outcome === 'good' && kills >= 1) {
    appendSafe(
      factionId,
      `【${campLabel}】向「${city}」突击 ${runs} 场，消灭守军 ${kills} 支，战果显赫。`,
      { category: CATEGORY.WAR },
    );
    return;
  }
  const early = stoppedEarly ? '（征发部队已溃散停战）' : '';
  appendSafe(
    factionId,
    `【${campLabel}】向「${city}」突击 ${runs} 场，守军奋勇抵抗，我军无奈撤退${early}。`,
    { category: CATEGORY.WAR },
  );
}

module.exports = {
  CATEGORY,
  BULLETIN_RETENTION_DAYS,
  BULLETIN_RETENTION_MS,
  retentionCutoffDate,
  purgeExpiredBulletinsForFaction,
  formatTimestamp,
  append,
  appendOnConnection,
  appendSafe,
  listForFaction,
  listGroupedForFaction,
  logDasikongEdict,
  logPvpWarStarted,
  logPvpWarEnded,
  logPveWarStarted,
  logPveWarSiegeCompleted,
  logConscriptAssaultSummary,
};
