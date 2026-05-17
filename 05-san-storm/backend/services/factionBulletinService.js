/**
 * 势力公告流水（大地图「势力」Tab：横屏第四象限与竖屏「公告」子 Tab 共用）
 *
 * 表：`faction_bulletins`（见 migrations/create-faction-bulletins.sql；旧名迁移 rename-faction-bulletin-entries-to-faction-bulletins.sql）
 * 写入：PVP/PVE 战事发起与结束时由业务服务 fire-and-forget 调用，失败仅打日志。
 */

const { pool } = require('../database/connection');

function formatTimestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * @param {string} factionId
 * @param {string} textWithoutBracket - 不含时间戳的正文，将自动前缀 `[YYYY-MM-DD HH:mm:ss] `
 */
async function append(factionId, textWithoutBracket) {
  if (!factionId || typeof textWithoutBracket !== 'string') return;
  const body = `[${formatTimestamp()}] ${textWithoutBracket}`.slice(0, 512);
  await pool.query(
    'INSERT INTO faction_bulletins (faction_id, body) VALUES (?, ?)',
    [factionId, body],
  );
}

/**
 * 非阻塞写入（避免战事事务回滚受公告失败牵连）。
 *
 * @param {string} factionId
 * @param {string} textWithoutBracket
 */
function appendSafe(factionId, textWithoutBracket) {
  append(factionId, textWithoutBracket).catch((err) => {
    console.error('[factionBulletin] append failed:', factionId, err.message);
  });
}

/**
 * @param {string} factionId
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{ id: number, body: string, createdAt: string }>>}
 */
async function listForFaction(factionId, opts = {}) {
  if (!factionId) return [];
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  const [rows] = await pool.query(
    'SELECT id, body, created_at AS createdAt FROM faction_bulletins WHERE faction_id = ? ORDER BY id DESC LIMIT ?',
    [factionId, limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    body: r.body,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));
}

/** PVP 战事已 active（含大本营） */
function logPvpWarStarted(war) {
  const city = war.targetCityName || war.targetCityId || '目标城';
  const attName = war.attackerFactionName || '敌军';
  appendSafe(war.attackerFactionId, `PVP 战事：我军向「${city}」进军，战事已开（攻方）。`);
  appendSafe(war.defenderFactionId, `PVP 战事：「${attName}」进犯我方「${city}」，战事已开（守方）。`);
}

/**
 * @param {object} war - formatPvpWarRow
 * @param {{ status: string, winnerFactionId?: string|null, victoryCondition?: string|null, cancelReason?: string, endedByOfficial?: boolean, neverActivated?: boolean }} end
 */
function logPvpWarEnded(war, end) {
  const city = war.targetCityName || war.targetCityId || '目标城';
  const { status, winnerFactionId, endedByOfficial, cancelReason, neverActivated } = end;

  if (endedByOfficial) {
    const reason = cancelReason ? `（${String(cancelReason).slice(0, 80)}）` : '';
    appendSafe(
      war.attackerFactionId,
      `战事结束：由一品官职官员（position_level=1）主持结案，本场战事已止${reason}`,
    );
    appendSafe(
      war.defenderFactionId,
      `战事结束：由一品官职官员（position_level=1）主持结案，本场战事已止${reason}`,
    );
    return;
  }

  if (status === 'cancelled' && neverActivated) {
    appendSafe(
      war.attackerFactionId,
      `战事筹划已解除：针对「${city}」的进犯未落营开战，草案已撤销。`,
    );
    appendSafe(
      war.defenderFactionId,
      `战事筹划已解除：敌方针对「${city}」的进犯未正式开战，草案已撤销。`,
    );
    return;
  }

  if (status === 'cancelled') {
    const tail = cancelReason ? ` ${String(cancelReason).slice(0, 120)}` : '';
    appendSafe(war.attackerFactionId, `战事结束：本场已撤销/解除。${tail}`.trim());
    appendSafe(war.defenderFactionId, `战事结束：本场已撤销/解除。${tail}`.trim());
    return;
  }

  const att = war.attackerFactionId;
  const def = war.defenderFactionId;
  const win = winnerFactionId;

  if (status === 'completed' && win === att) {
    appendSafe(att, `战事结束：我军告捷，「${city}」战局已定（攻方胜利）。`);
    appendSafe(def, `战事结束：我军失利，「${city}」战局已定（守方失利）。`);
  } else if (status === 'completed' && win === def) {
    appendSafe(att, `战事结束：我军失利，「${city}」战局已定（守方固守/终局）。`);
    appendSafe(def, `战事结束：我军告捷，「${city}」战局已定（守方胜利）。`);
  } else if (status === 'failed' && win === def) {
    appendSafe(att, `战事结束：我军失利，「${city}」战局已定（大本营失守）。`);
    appendSafe(def, `战事结束：我军告捷，「${city}」战局已定（守方胜利）。`);
  } else {
    appendSafe(att, `战事结束：「${city}」战事已结案（${status || '—'}）。`);
    appendSafe(def, `战事结束：「${city}」战事已结案（${status || '—'}）。`);
  }
}

function logPveWarStarted(factionId, cityName, cityId) {
  const label = cityName || cityId || '中立城';
  appendSafe(factionId, `PVE 战事：我军对中立城「${label}」发起攻城，战事已开。`);
}

function logPveWarSiegeCompleted(winnerFactionId, cityName, cityId) {
  if (!winnerFactionId) return;
  const label = cityName || cityId || '城池';
  appendSafe(winnerFactionId, `PVE 战事结束：我军击破「${label}」守军，城池易主。`);
}

module.exports = {
  formatTimestamp,
  append,
  appendSafe,
  listForFaction,
  logPvpWarStarted,
  logPvpWarEnded,
  logPveWarStarted,
  logPveWarSiegeCompleted,
};
