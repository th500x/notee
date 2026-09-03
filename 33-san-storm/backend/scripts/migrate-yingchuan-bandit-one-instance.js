/**
 * 颍川匪寨一寨收口（13-8）：
 * - ensure `san_1_bandit_1_yingchuan`
 * - 合并 player_progress.bandit_progress 中 `_2_` → `_1_`（nextLayer 取较高）
 * - 删除 bandits 表 `_2_` 行
 *
 * Usage (from 33-san-storm/backend):
 *   node scripts/migrate-yingchuan-bandit-one-instance.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../database/connection');
const {
  ensureBanditRowsForPoiIds,
} = require('../services/banditInstanceService');
const {
  YINGCHUAN_BATTLEFIELD_BANDIT_POI_ID,
} = require('../../shared/utils/strategicBanditPlaceholderPhase1.js');

const KEEP = YINGCHUAN_BATTLEFIELD_BANDIT_POI_ID;
const DROP = 'san_1_bandit_2_yingchuan';
const JUN = 'san_1_jun_yingchuan';

function parseProgress(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

function mergeNextLayer(a, b) {
  const na = Number(a?.nextLayer);
  const nb = Number(b?.nextLayer);
  const aOk = Number.isFinite(na) ? na : 1;
  const bOk = Number.isFinite(nb) ? nb : 1;
  const nextLayer = Math.max(aOk, bOk);
  const out = { ...(a && typeof a === 'object' ? a : {}), ...(b && typeof b === 'object' ? b : {}), nextLayer };
  return out;
}

async function main() {
  await ensureBanditRowsForPoiIds([KEEP], JUN);

  const [rows] = await pool.query(
    `SELECT player_id, bandit_progress FROM player_progress WHERE bandit_progress IS NOT NULL`,
  );
  let mergedPlayers = 0;
  for (const row of rows) {
    const prog = parseProgress(row.bandit_progress);
    const by = prog.byBanditMapObjectId;
    if (!by || typeof by !== 'object') continue;
    if (!Object.prototype.hasOwnProperty.call(by, DROP)) continue;
    const dropEntry = by[DROP];
    const keepEntry = by[KEEP];
    by[KEEP] = mergeNextLayer(keepEntry, dropEntry);
    delete by[DROP];
    prog.byBanditMapObjectId = by;
    await pool.query(`UPDATE player_progress SET bandit_progress = ? WHERE player_id = ?`, [
      JSON.stringify(prog),
      row.player_id,
    ]);
    mergedPlayers += 1;
  }

  const [del] = await pool.query(`DELETE FROM bandits WHERE bandit_id = ?`, [DROP]);
  console.log(
    JSON.stringify(
      {
        ok: true,
        keep: KEEP,
        drop: DROP,
        mergedPlayers,
        deletedBanditRows: del.affectedRows,
      },
      null,
      2,
    ),
  );
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
