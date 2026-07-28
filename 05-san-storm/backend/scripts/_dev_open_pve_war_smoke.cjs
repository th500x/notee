/**
 * `cityService.openPveWarOnNeutralCity` 真库幂等冒烟（手动清理，不留痕）。
 * 用法：node backend/scripts/_dev_open_pve_war_smoke.cjs
 */
require('dotenv').config({ path: __dirname + '/../.env' });

const cityService = require('../services/cityService');
const { pool } = require('../database/connection');

const TARGET_CITY_ID = process.argv[2] || 'san_1_city_pingjingguan';
const FAKE_KING_CHARACTER_ID = 'san_1_char_1001';

(async () => {
  try {
    // 先清掉残留 wars 行（避免上一次测试遗留导致 created=false 的误判）
    await pool.query("DELETE FROM wars WHERE target_city_id = ? AND status = 'active'", [
      TARGET_CITY_ID,
    ]);

    const r1 = await cityService.openPveWarOnNeutralCity(TARGET_CITY_ID, {
      openedByCharacterId: FAKE_KING_CHARACTER_ID,
    });
    console.log('1st call:', JSON.stringify({
      warId: r1.warId,
      created: r1.created,
      npcAlive: r1.npcAlive,
      openedByCharacterId: r1.openedByCharacterId,
    }));

    const r2 = await cityService.openPveWarOnNeutralCity(TARGET_CITY_ID, {
      openedByCharacterId: FAKE_KING_CHARACTER_ID,
    });
    console.log('2nd call:', JSON.stringify({
      warId: r2.warId,
      created: r2.created,
    }));

    const idempotent = r1.warId === r2.warId && r2.created === false;
    console.log('IDEMPOTENT:', idempotent ? 'PASS' : 'FAIL');

    // 清理本次留下的 wars 行（避免污染后续 PVE 测试）
    await pool.query('DELETE FROM wars WHERE war_id = ?', [r1.warId]);
    console.log('cleanup wars row:', r1.warId);

    process.exit(idempotent ? 0 : 1);
  } catch (e) {
    console.error('ERR', e.message);
    process.exit(2);
  }
})();
