/**
 * 本赛季已有部队卡：按现行稀有度表校准 max_battle_count；
 * battle_count 仅夹到新上限（不清零——那是跨季继承才做的）。
 *
 * 用法（在 33-san-storm/backend）：
 *   node scripts/calibrate-troop-max-battle-count.js           # dry-run
 *   node scripts/calibrate-troop-max-battle-count.js --apply   # 写库
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const {
  MAX_BATTLE_COUNT_BY_RARITY,
  getMaxBattleCount,
} = require('../../shared/utils/troopMaxBattleCount.cjs');

const APPLY = process.argv.includes('--apply');

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'san_storm',
  });

  const [rows] = await pool.query(
    `SELECT instance_id, player_id, card_id, rarity, battle_count, max_battle_count
     FROM player_cards
     WHERE card_type = 'troop'`,
  );

  /** @type {Array<{ instance_id: string, rarity: string, oldMax: number|null, newMax: number, oldBattle: number, newBattle: number }>} */
  const changes = [];
  for (const r of rows) {
    const rarity = String(r.rarity || '').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(MAX_BATTLE_COUNT_BY_RARITY, rarity)) {
      console.warn('[skip unknown rarity]', r.instance_id, r.rarity);
      continue;
    }
    const newMax = getMaxBattleCount(rarity);
    const oldMax = r.max_battle_count == null ? null : Number(r.max_battle_count);
    const oldBattle = Math.max(0, Number(r.battle_count) || 0);
    const newBattle = Math.min(oldBattle, newMax);
    if (oldMax !== newMax || oldBattle !== newBattle) {
      changes.push({
        instance_id: r.instance_id,
        rarity,
        oldMax,
        newMax,
        oldBattle,
        newBattle,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'APPLY' : 'DRY_RUN',
        scanned: rows.length,
        toFix: changes.length,
        sample: changes.slice(0, 15),
      },
      null,
      2,
    ),
  );

  if (!APPLY) {
    console.log('提示：确认后加 --apply 写库（只改上限并夹 battle_count，不清零）');
    await pool.end();
    return;
  }

  let updated = 0;
  for (const c of changes) {
    const [res] = await pool.query(
      `UPDATE player_cards
       SET max_battle_count = ?, battle_count = ?
       WHERE instance_id = ? AND card_type = 'troop'`,
      [c.newMax, c.newBattle, c.instance_id],
    );
    updated += res.affectedRows || 0;
  }
  console.log('updated rows:', updated);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
