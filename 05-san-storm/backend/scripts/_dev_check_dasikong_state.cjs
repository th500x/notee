/**
 * 大司空日榜诊断（本地 / 生产只读均可跑）
 *   cd 05-san-storm/backend && node scripts/_dev_check_dasikong_state.cjs
 *   node scripts/_dev_check_dasikong_state.cjs san_1_faction_1001
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../database/connection');
const aiKingConfigService = require('../services/aiKingConfigService');
const aiKingDasikongDailyService = require('../services/aiKingDasikongDailyService');
const kingDasikongRankingService = require('../services/kingDasikongRankingService');
const { EVENT_ID } = require('../config/kingDasikongDaily');

const onlyFaction = process.argv[2] ? String(process.argv[2]).trim() : '';

(async () => {
  const hasColumn = await (async () => {
    const conn = await pool.getConnection();
    try {
      return kingDasikongRankingService.hasBaselineDateColumn(conn);
    } finally {
      conn.release();
    }
  })();
  console.log('baseline_date column:', hasColumn ? 'yes' : 'MISSING');

  const kings = aiKingConfigService.listAllKings().filter(
    (k) => !onlyFaction || k.factionId === onlyFaction,
  );

  for (const king of kings) {
    const diag = await aiKingDasikongDailyService.getFactionDasikongDiagnostic(king.factionId);
    console.log('\n==========', king.factionId, king.characterName, '==========');
    console.log(JSON.stringify(diag, null, 2));
  }

  console.log('\n--- pm2 日志检索建议 ---');
  console.log('grep -E "\\[aiKing\\]\\[dasikong\\]" ~/.pm2/logs/san-storm-backend-out.log | tail -80');

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
