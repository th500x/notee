/**
 * 校验 event 管线：CSV 行数 / events.json / config_events（san_1）三者 event_id 集合与抽样字段一致。
 * 用法（cwd：05-san-storm/backend）：node scripts/verify-events-pipeline.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ROOT = path.join(__dirname, '../..');
const CSV_PATH = path.join(ROOT, 'docs/tools/event/event-template.csv');
const JSON_PATH = path.join(ROOT, 'public/data/shared/events.json');

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
  const events = payload.events || [];
  const jsonIds = events.map((e) => e.id).filter(Boolean);
  const jsonSet = new Set(jsonIds);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    charset: 'utf8mb4',
  });

  const [dbRows] = await conn.query(
    `SELECT event_id, season, location, event_name, event_hint, trigger_context, chain_id, chain_level
     FROM config_events WHERE season = ? ORDER BY event_id`,
    ['san_1'],
  );
  await conn.end();

  const dbIds = dbRows.map((r) => r.event_id);
  const dbSet = new Set(dbIds);

  const dbById = Object.fromEntries(dbRows.map((r) => [r.event_id, r]));

  let fieldMismatches = 0;
  const missingInDb = [];
  for (const je of events) {
    const id = je.id;
    const dr = dbById[id];
    if (!dr) {
      missingInDb.push(id);
      continue;
    }
    const locJ = String(je.location ?? '').trim();
    const locD = String(dr.location ?? '').trim();
    const nameJ = String(je.name ?? '').trim();
    const nameD = String(dr.event_name ?? '').trim();
    const hintJ = String(je.eventHint ?? '').trim();
    const hintD = String(dr.event_hint ?? '').trim();
    if (locJ !== locD || nameJ !== nameD || hintJ !== hintD) {
      fieldMismatches++;
      console.error(
        `  字段不一致 ${id}: location JSON="${locJ}" DB="${locD}" | name JSON="${nameJ}" DB="${nameD}" | hint JSON="${hintJ}" DB="${hintD}"`,
      );
    }
  }

  /** import-events-data.js 只 UPSERT，库内可能残留旧赛季同前缀 id；与 CSV 一致性以「JSON 每条在 DB 中字段对齐」为准 */
  const extraDbIdsNotInCurrentCsv = [...dbSet].filter((id) => !jsonSet.has(id));

  const pipelineOk =
    csvRows === events.length &&
    missingInDb.length === 0 &&
    fieldMismatches === 0;

  console.log(JSON.stringify({
    csvDataRows: csvRows,
    jsonMetaCount: payload._meta?.count ?? events.length,
    jsonEventsLength: events.length,
    dbSan1TotalRows: dbRows.length,
    extraDbRowsNotInCurrentPipeline: extraDbIdsNotInCurrentCsv.length,
    extraDbSample: extraDbIdsNotInCurrentCsv.slice(0, 8),
    missingInDbForJsonExport: missingInDb,
    jsonVsDbFieldMismatches: fieldMismatches,
    pipelineCsvJsonDbAligned: pipelineOk,
  }, null, 2));

  if (!pipelineOk) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
