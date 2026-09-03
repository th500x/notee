/**
 * 校验道具管线：CSV 有效行数 / items.json / config_items 条目 id 集合与抽样字段。
 * 用法（cwd backend）：node scripts/verify-items-pipeline.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ROOT = path.join(__dirname, '../..');
const CSV_PATH = path.join(ROOT, 'docs/tools/event/item-template.csv');
const JSON_PATH = path.join(ROOT, 'public/data/shared/items.json');

function countCsvDataRows() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return 0;
  let n = 0;
  for (let i = 1; i < lines.length; i++) {
    const firstCell = lines[i].split(',')[0]?.trim();
    if (firstCell) n++;
  }
  return n;
}

async function main() {
  const csvRows = countCsvDataRows();
  const payload = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const items = payload.items || [];
  const jsonIds = items.map((it) => it.id).filter(Boolean);
  const jsonSet = new Set(jsonIds);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    charset: 'utf8mb4',
  });

  const [[{ totalDb }]] = await conn.query(
    'SELECT COUNT(*) AS totalDb FROM config_items',
  );

  const [dbRows] = await conn.query(
    `SELECT item_id, item_name, season FROM config_items ORDER BY item_id`,
  );
  await conn.end();

  const dbIds = dbRows.map((r) => r.item_id);
  const dbSet = new Set(dbIds);
  const dbById = Object.fromEntries(dbRows.map((r) => [r.item_id, r]));

  const missingInDb = [...jsonSet].filter((id) => !dbSet.has(id));

  let fieldMismatches = 0;
  for (const ji of items) {
    const id = ji.id;
    const dr = dbById[id];
    if (!dr) continue;
    const nameJ = String(ji.name ?? '').trim();
    const nameD = String(dr.item_name ?? '').trim();
    const sj = String(ji.season ?? '').trim();
    const sd = dr.season != null ? String(dr.season).trim() : '';
    if (nameJ !== nameD || sj !== sd) {
      fieldMismatches++;
      console.error(
        `  字段不一致 ${id}: name JSON="${nameJ}" DB="${nameD}" | season JSON="${sj}" DB="${sd}"`,
      );
    }
  }

  const extraDbNotInPipeline = [...dbSet].filter((id) => !jsonSet.has(id));

  const pipelineOk =
    csvRows === items.length &&
    missingInDb.length === 0 &&
    fieldMismatches === 0 &&
    extraDbNotInPipeline.length === 0 &&
    Number(totalDb) === items.length;

  console.log(JSON.stringify({
    csvDataRows: csvRows,
    jsonMetaCount: payload._meta?.count ?? items.length,
    jsonItemsLength: items.length,
    dbConfigItemsTotalRows: totalDb,
    extraDbRowsNotInCurrentCsv: extraDbNotInPipeline.length,
    extraDbSample: extraDbNotInPipeline.slice(0, 15),
    missingInDbForJsonExport: missingInDb,
    jsonVsDbFieldMismatches: fieldMismatches,
    pipelineCsvJsonDbAligned: pipelineOk,
    note:
      extraDbNotInPipeline.length > 0
        ? 'DB 中存在不在当前 item-template.csv/items.json 的道具行（import 仅 UPSERT）；与事件表类似可单独清理。'
        : null,
  }, null, 2));

  if (!pipelineOk || missingInDb.length || fieldMismatches) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
