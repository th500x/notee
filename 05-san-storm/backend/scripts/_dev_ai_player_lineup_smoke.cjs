/**
 * 开发自检：对若干 elite AI 跑 refreshAiPlayerLineup，打印将领/部队槽与主阵容总兵力，
 * 断言达到 MIN_MAIN_LINEUP_TROOPS_BATTLE（背包足量时）。
 *
 * 用法（backend 目录）：node scripts/_dev_ai_player_lineup_smoke.cjs [数量,默认3]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../database/connection');
const { refreshAiPlayerLineup } = require('../services/aiPlayerLineupService');

async function main() {
  const limit = Number.parseInt(process.argv[2], 10) || 3;
  const [ais] = await pool.query(
    `SELECT p.player_id, p.character_name, p.faction_name
       FROM players p JOIN accounts a ON a.id = p.player_id
      WHERE a.account_type = 'ai'
      ORDER BY p.player_id LIMIT ?`,
    [limit],
  );
  if (ais.length === 0) {
    console.log('未找到 AI 玩家，请先运行 seed-ai-players.js');
    return;
  }

  let pass = 0;
  for (const ai of ais) {
    const r = await refreshAiPlayerLineup(ai.player_id);
    const flag = r.meetsBattleGate ? 'OK' : 'LOW';
    if (r.meetsBattleGate) pass += 1;
    console.log(
      `[${flag}] ${ai.character_name}（${ai.player_id}，${ai.faction_name}）` +
        ` 将领=${r.generals} 部队槽=${r.troopSlots} 主阵容兵力=${r.mainLineupTroops}`,
    );
  }
  console.log(`\n达到兵力下限：${pass}/${ais.length}`);
}

main()
  .then(async () => { await pool.end(); process.exit(0); })
  .catch(async (e) => { console.error(e); try { await pool.end(); } catch (_) {} process.exit(1); });
