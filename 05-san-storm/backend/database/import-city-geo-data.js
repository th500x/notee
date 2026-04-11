/**
 * 州 / 郡 / 城市静态种子 — JSON → MySQL（MariaDB / XAMPP 兼容）
 *
 * 依赖表:
 *   - config_zhou, config_jun, config_jun_node（先执行 migrations/create-config-zhou-jun.sql）
 *   - cities（migrations/add-city-siege-tables.sql 等）
 *   - **注意**：`cities.faction_id` 外键指向的是 **运行时表 `factions`**，不是 `config_factions`。
 *     `import-config-data.js factions` 只写入 **`config_factions`**；若库里只有配置表、运行时 `factions` 无对应 `id`，
 *     会报 `cities_ibfk_1`。本脚本在写入 cities 前会按种子用到的势力 id，从 `config_factions` **补全 `factions` 缺行**
 *     （与是否「曾跑过势力导入」无关：配置表有而运行时表无，仍属常见情况）。
 *
 * 输入 JSON（由 docs/tools/city/city-csv-to-json.cjs 生成）:
 *   public/data/shared/config_zhou.json
 *   public/data/shared/config_jun.json
 *   public/data/shared/cities_seed.json
 *
 * 说明:
 *   - 本脚本不写 config_jun_node；邻接边由地图 / preset 工具链另行导入。
 *   - 种子行 is_buildable=0；若需预设可建造空地，由地图管线 UPDATE cities.is_buildable 等。
 *   - 种子 JSON 里 `initialFactionId` 若为 `""` 会规范为 SQL NULL，避免误写入空串触发外键失败。
 *
 * 用法:
 *   node backend/database/import-city-geo-data.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '05_san_storm',
  charset: 'utf8mb4',
};

const SHARED = path.join(__dirname, '../../public/data/shared');

async function readJson(name) {
  const p = path.join(SHARED, name);
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
}

function cityPk(r) {
  return r.cityId ?? r.id;
}

function orderCitiesForInsert(records) {
  const byId = new Map(records.map((r) => [cityPk(r), r]));
  const remaining = new Set(records.map((r) => cityPk(r)));
  const ordered = [];

  while (remaining.size) {
    let progressed = false;
    for (const id of [...remaining]) {
      const r = byId.get(id);
      const p = r.parentCityId;
      if (!p || !remaining.has(p)) {
        ordered.push(r);
        remaining.delete(id);
        progressed = true;
      }
    }
    if (!progressed) {
      throw new Error(
        `cities 种子存在循环依赖或 parent_city_id 指向种子外: ${[...remaining].join(', ')}`
      );
    }
  }
  return ordered;
}

function zhouRow(z) {
  const zhouId = z.zhouId ?? z.id;
  const zhouName = z.zhouName ?? z.name;
  if (!zhouId) throw new Error('config_zhou 缺少 zhouId（或旧字段 id）');
  return { zhouId, zhouName, season: z.season, sortOrder: z.sortOrder, enabled: z.enabled, description: z.description };
}

function junRow(j) {
  const junId = j.junId ?? j.id;
  const junName = j.junName ?? j.name;
  if (!junId) throw new Error('config_jun 缺少 junId（或旧字段 id）');
  return {
    junId,
    junName,
    season: j.season,
    zhouId: j.zhouId,
    sortOrder: j.sortOrder,
    enabled: j.enabled,
    description: j.description,
  };
}

async function importZhou(conn, rows) {
  let n = 0;
  for (const z of rows) {
    const r = zhouRow(z);
    await conn.query(
      `INSERT INTO config_zhou (zhou_id, season, zhou_name, sort_order, enabled, description)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         season = VALUES(season),
         zhou_name = VALUES(zhou_name),
         sort_order = VALUES(sort_order),
         enabled = VALUES(enabled),
         description = VALUES(description)`,
      [r.zhouId, r.season, r.zhouName, r.sortOrder, r.enabled, r.description]
    );
    n++;
  }
  console.log(`  config_zhou: ${n} 条`);
}

async function importJun(conn, rows) {
  let n = 0;
  for (const j of rows) {
    const r = junRow(j);
    await conn.query(
      `INSERT INTO config_jun (jun_id, season, zhou_id, jun_name, sort_order, enabled, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         season = VALUES(season),
         zhou_id = VALUES(zhou_id),
         jun_name = VALUES(jun_name),
         sort_order = VALUES(sort_order),
         enabled = VALUES(enabled),
         description = VALUES(description)`,
      [r.junId, r.season, r.zhouId, r.junName, r.sortOrder, r.enabled, r.description]
    );
    n++;
  }
  console.log(`  config_jun: ${n} 条`);
}

function finalsForCity(c) {
  const fc = (c.commerce ?? 0) + (c.specialResourceCommerce ?? 0);
  const ff = (c.farming ?? 0) + (c.specialResourceFarming ?? 0);
  return { finalCommerce: fc, finalFarming: ff };
}

/** 写入 DB 的 faction_id：null / 空串 → NULL，否则为 trim 后的字符串 */
function normalizedFactionIdFromCity(c) {
  const v = c.initialFactionId;
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

async function insertCityRow(conn, c) {
  const { finalCommerce, finalFarming } = finalsForCity(c);
  const isBuildable = 0;
  const buildStatus = 'empty';

  const cid = cityPk(c);
  const gcap = c.playerGarrisonCapacity ?? c.garrisonCapacity ?? 0;

  await conn.query(
    `INSERT INTO cities (
      city_id, season, city_name, city_type, faction_id,
      jun_id, zhou_id, parent_city_id,
      position_x, position_y,
      population, commerce, farming, military, culture,
      special_resource_name, special_resource_commerce, special_resource_farming,
      final_commerce, final_farming,
      lord_player_id, lord_appointed_at,
      defense, player_garrison_capacity,
      npc_garrison, npc_garrison_alive,
      status, is_capital,
      is_buildable, build_status, built_by_player_id, built_at, build_complete_at, custom_name,
      buildings_state
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      NULL, NULL,
      ?, ?,
      NULL, 0,
      'neutral', 0,
      ?, ?, NULL, NULL, NULL, NULL,
      NULL
    )
    ON DUPLICATE KEY UPDATE
      season = VALUES(season),
      city_name = VALUES(city_name),
      city_type = VALUES(city_type),
      faction_id = VALUES(faction_id),
      jun_id = VALUES(jun_id),
      zhou_id = VALUES(zhou_id),
      parent_city_id = VALUES(parent_city_id),
      position_x = VALUES(position_x),
      position_y = VALUES(position_y),
      population = VALUES(population),
      commerce = VALUES(commerce),
      farming = VALUES(farming),
      military = VALUES(military),
      culture = VALUES(culture),
      special_resource_name = VALUES(special_resource_name),
      special_resource_commerce = VALUES(special_resource_commerce),
      special_resource_farming = VALUES(special_resource_farming),
      final_commerce = VALUES(final_commerce),
      final_farming = VALUES(final_farming),
      defense = VALUES(defense),
      player_garrison_capacity = VALUES(player_garrison_capacity),
      is_buildable = VALUES(is_buildable),
      build_status = VALUES(build_status)`,
    [
      cid,
      c.season,
      c.cityName,
      c.cityType,
      normalizedFactionIdFromCity(c),
      c.junId,
      c.zhouId,
      c.parentCityId,
      c.positionX,
      c.positionY,
      c.population,
      c.commerce,
      c.farming,
      c.military,
      c.culture,
      c.specialResourceName,
      c.specialResourceCommerce,
      c.specialResourceFarming,
      finalCommerce,
      finalFarming,
      c.defense,
      gcap,
      isBuildable,
      buildStatus,
    ]
  );
}

/**
 * 运行时 `factions` 缺行时从 `config_factions` UPSERT（见文件头「两张表」说明）。
 */
async function ensureRuntimeFactionsForCitySeed(conn, cityRecords) {
  const ids = [...new Set(cityRecords.map(normalizedFactionIdFromCity).filter(Boolean))];
  if (!ids.length) return;

  const ph = ids.map(() => '?').join(',');
  const [haveRows] = await conn.query(`SELECT id FROM factions WHERE id IN (${ph})`, ids);
  const have = new Set(haveRows.map((r) => r.id));
  const missing = ids.filter((id) => !have.has(id));
  if (!missing.length) {
    console.log('  factions（运行时）: 种子所需势力 id 均已存在，跳过补全');
    return;
  }

  const ph2 = missing.map(() => '?').join(',');
  const [cfgRows] = await conn.query(
    `SELECT faction_id, season, faction_name FROM config_factions WHERE faction_id IN (${ph2})`,
    missing
  );
  const cfgById = new Map(cfgRows.map((r) => [r.faction_id, r]));
  const notInConfig = missing.filter((id) => !cfgById.has(id));
  if (notInConfig.length) {
    throw new Error(
      `cities_seed 中的 initialFactionId 在 config_factions 中不存在，无法写入 factions：${notInConfig.join(
        ', '
      )}。请先执行：cd backend && node database/import-config-data.js factions`
    );
  }

  for (const id of missing) {
    const r = cfgById.get(id);
    await conn.query(
      `INSERT INTO factions (
        id, season, faction_name,
        silver_reserve, food_reserve,
        troop_orange_probability, character_orange_probability,
        player_count, city_count, total_power, last_settlement_at
      ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, NULL)
      ON DUPLICATE KEY UPDATE
        season = VALUES(season),
        faction_name = VALUES(faction_name)`,
      [r.faction_id, r.season, r.faction_name]
    );
  }
  console.log(`  factions（运行时）: 已从 config_factions 补全 ${missing.length} 条（${missing.join(', ')}）`);
}

async function importCities(conn, records) {
  if (!records.length) {
    console.log('  cities: 0 条');
    return;
  }
  await ensureRuntimeFactionsForCitySeed(conn, records);
  const ordered = orderCitiesForInsert(records);
  for (const c of ordered) {
    await insertCityRow(conn, c);
  }
  console.log(`  cities: ${ordered.length} 条`);
}

async function main() {
  console.log('import-city-geo-data: 读取 public/data/shared/*.json …\n');

  const zhouDoc = await readJson('config_zhou.json');
  const junDoc = await readJson('config_jun.json');
  const cityDoc = await readJson('cities_seed.json');

  const zhou = zhouDoc.zhou || [];
  const jun = junDoc.jun || [];
  const cities = cityDoc.cities || [];
  const legacySlots = cityDoc.fortSlotCities;
  if (Array.isArray(legacySlots) && legacySlots.length) {
    console.warn('  ⚠ cities_seed.json 含旧字段 fortSlotCities，已忽略；请重新运行 city-csv-to-json.cjs');
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await importZhou(connection, zhou);
    await importJun(connection, jun);
    await importCities(connection, cities);
    console.log('\n✅ import-city-geo-data 完成');
  } catch (e) {
    console.error('\n❌ 导入失败:', e.message);
    console.error('   若提示缺表，请先执行 migrations/create-config-zhou-jun.sql');
    console.error('   若提示 initialFactionId 不在 config_factions：请先 node database/import-config-data.js factions');
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

main();
