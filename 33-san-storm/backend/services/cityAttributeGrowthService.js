/**
 * 城池属性 · 开服/换季初值 + 已占城每日成长（13-1 §5.5 · 15-2）
 *
 * 纯抽样在 `shared/utils/cityInitialAttributes.cjs`；本服务负责读写库与 cron 幂等。
 * 人口写入后同步 NPC 守军编制上限（人口 × 1%）。
 */

const { pool } = require('../database/connection');
const { queryGameCalendarDateYmd } = require('../config/gameCalendar');
const {
  buildInitialCityAttributes,
  growOwnedCityAttributes,
} = require('../../shared/utils/cityInitialAttributes.cjs');

function mysqlDateToYmd(val) {
  if (val == null) return null;
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * 换季 / 开服：整图按 §5.5.1 重随人口·四维·城防（关隘四维强制 0），
 * 并按新人口整表重掷 NPC 守军（上限 = 人口 × 1%）。
 * 写入后标记 `attr_growth_applied_date = 今日`，避免换季当日再被日成长叠一次。
 *
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} [db]
 */
async function reseedAllCityAttributes(db = pool) {
  const cityService = require('./cityService');
  const todayStr = await queryGameCalendarDateYmd(db);
  if (!todayStr) {
    return { ok: false, error: 'cannot resolve CURDATE()', updated: 0, npcSynced: 0 };
  }
  const [rows] = await db.query(
    `SELECT city_id, city_type, special_resource_trading, special_resource_farming
     FROM cities`,
  );
  let updated = 0;
  let npcSynced = 0;
  for (const row of rows) {
    const attrs = buildInitialCityAttributes(row.city_type, {
      specialResourceTrading: row.special_resource_trading,
      specialResourceFarming: row.special_resource_farming,
    });
    await db.query(
      `UPDATE cities SET
         population = ?,
         trading = ?,
         farming = ?,
         military = ?,
         culture = ?,
         defense = ?,
         final_trading = ?,
         final_farming = ?,
         attr_growth_applied_date = ?
       WHERE city_id = ?`,
      [
        attrs.population,
        attrs.trading,
        attrs.farming,
        attrs.military,
        attrs.culture,
        attrs.defense,
        attrs.finalTrading,
        attrs.finalFarming,
        todayStr,
        row.city_id,
      ],
    );
    updated += 1;
    await cityService.syncNpcGarrisonCapToCityPopulation(row.city_id, {
      fullRegenerate: true,
    });
    npcSynced += 1;
  }
  return { ok: true, date: todayStr, updated, npcSynced };
}

/**
 * 每日 0:00：已归属势力的城（含关隘）各属性按概率 +1%/+2%/+3%，封顶 §5.4 上限；
 * 人口更新后同步 NPC 编制上限（扩/缩编，尽量保留既有 alive）。
 * 中立城不涨；同城同日幂等（`attr_growth_applied_date`）。
 *
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} [db]
 */
async function runDailyOwnedCityAttributeGrowthTick(db = pool) {
  const cityService = require('./cityService');
  const todayStr = await queryGameCalendarDateYmd(db);
  if (!todayStr) {
    return {
      ok: false,
      error: 'cannot resolve CURDATE()',
      date: null,
      scanned: 0,
      updated: 0,
      grew: 0,
      npcSynced: 0,
    };
  }

  const [rows] = await db.query(
    `SELECT city_id, city_type, population, trading, farming, military, culture, defense,
            special_resource_trading, special_resource_farming, attr_growth_applied_date
     FROM cities
     WHERE status = 'owned'
       AND faction_id IS NOT NULL
       AND TRIM(faction_id) <> ''
       AND (attr_growth_applied_date IS NULL OR attr_growth_applied_date < ?)`,
    [todayStr],
  );

  let updated = 0;
  let grew = 0;
  let npcSynced = 0;
  for (const row of rows) {
    const applied = mysqlDateToYmd(row.attr_growth_applied_date);
    if (applied && applied === todayStr) continue;

    const result = growOwnedCityAttributes(row);
    if (!result.ok) {
      console.error(
        `[cityAttrGrowth] skip city_id=${row.city_id}: ${result.error}`,
      );
      continue;
    }
    const { attrs } = result;
    await db.query(
      `UPDATE cities SET
         population = ?,
         trading = ?,
         farming = ?,
         military = ?,
         culture = ?,
         defense = ?,
         final_trading = ?,
         final_farming = ?,
         attr_growth_applied_date = ?
       WHERE city_id = ?`,
      [
        attrs.population,
        attrs.trading,
        attrs.farming,
        attrs.military,
        attrs.culture,
        attrs.defense,
        attrs.finalTrading,
        attrs.finalFarming,
        todayStr,
        row.city_id,
      ],
    );
    updated += 1;
    if (result.anyGrew) grew += 1;

    try {
      const sync = await cityService.syncNpcGarrisonCapToCityPopulation(row.city_id);
      if (sync.resized) npcSynced += 1;
    } catch (e) {
      console.error(
        `[cityAttrGrowth] NPC sync failed city_id=${row.city_id}: ${e.message}`,
      );
    }
  }

  return {
    ok: true,
    date: todayStr,
    scanned: rows.length,
    updated,
    grew,
    npcSynced,
  };
}

/** 启动补跑：漏跑 0:00 时自愈（属性成长 + NPC 损兵恢复） */
async function runStaleCatchUpOnStartup(db = pool) {
  const growth = await runDailyOwnedCityAttributeGrowthTick(db);
  const cityService = require('./cityService');
  const npcRecovery = await cityService.runDailyNpcGarrisonRecoveryTick(db);
  return {
    ...growth,
    npcRecovery,
  };
}

module.exports = {
  reseedAllCityAttributes,
  runDailyOwnedCityAttributeGrowthTick,
  runStaleCatchUpOnStartup,
};
