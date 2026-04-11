/**
 * 为新野城（或指定城市）注入/刷新 NPC 守军，默认 400 支（测试用）。
 *
 * 大地图显示「?/?」通常是因为 cities 表里没有该行，GET /api/cities/:id 返回 404，
 * 前端拿不到 npc_garrison。本脚本会先 UPSERT 城市行，再生成守军。
 *
 * 已有 HTTP（仅当城市行已存在时）：
 *   POST /api/cities/:cityId/generate-npc
 *
 * 用法（在 backend 目录下，依赖 .env 数据库配置）：
 *   node database/scripts/seed-xinye-npc-garrison-400.js
 *   node database/scripts/seed-xinye-npc-garrison-400.js san_1_city_3_xinye 400
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const cityService = require('../../services/cityService');
const { pool } = require('../../database/connection');

const CITY_ID = process.argv[2] || 'san_1_city_3_xinye';
const TROOP_COUNT = Math.min(2000, Math.max(1, parseInt(process.argv[3] || '400', 10) || 400));

/** 与 WorldMap.jsx CITY_ID、攻城测试一致；无行则 API 404 → 界面 ?/? */
const DEFAULT_XINYE = {
  city_id: 'san_1_city_3_xinye',
  season: 'san_1',
  city_name: '新野城',
  city_type: 'city_small',
};

/**
 * 确保 cities 存在主键行（不覆盖已有归属/名称，仅插入缺失行）。
 */
async function ensureCityRow(cityId) {
  const meta =
    cityId === DEFAULT_XINYE.city_id
      ? DEFAULT_XINYE
      : { city_id: cityId, season: 'san_1', city_name: cityId, city_type: 'city_small' };

  await pool.query(
    `INSERT INTO cities (city_id, season, city_name, city_type, status, faction_id)
     VALUES (?, ?, ?, ?, 'neutral', NULL)
     ON DUPLICATE KEY UPDATE city_id = city_id`,
    [meta.city_id, meta.season, meta.city_name, meta.city_type],
  );
  console.log(`[seed-xinye-npc] cities 行已就绪: ${cityId}`);
}

(async () => {
  try {
    await ensureCityRow(CITY_ID);
    const result = await cityService.generateNpcGarrison(CITY_ID, {
      troopCountOverride: TROOP_COUNT,
    });
    console.log(`[seed-xinye-npc] OK ${CITY_ID} npcCount=${result.npcCount}`);
    await pool.end();
    process.exit(0);
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('[seed-xinye-npc]', msg);
    if (msg.includes('城市不存在')) {
      try {
        const [rows] = await pool.query(
          'SELECT city_id, city_name FROM cities ORDER BY city_id LIMIT 40',
        );
        console.error('[seed-xinye-npc] 当前库 cities 样例（请核对 city id）：');
        console.table(rows);
      } catch (q) {
        console.error('[seed-xinye-npc] 无法列出 cities:', q.message);
      }
    }
    await pool.end().catch(() => {});
    process.exit(1);
  }
})();
