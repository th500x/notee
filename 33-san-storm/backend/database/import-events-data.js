/**
 * 事件配置数据导入 MySQL
 *
 * 运行时：游戏 GET /api/config/events 读的是「本表」里的数据（configService 查 MySQL），
 * 请求链路不会读 public/data/shared/events.json。
 *
 * 管线入库：event-template.csv → event-csv-to-json.cjs（CSV 整表写 JSON）→ public/data/shared/events.json → **本脚本** → config_events。
 * 若中间 JSON 与 CSV 未对齐，导入后库里仍是旧选项/奖励串——排查时要看「CSV→JSON→本导入」是否跑全，而非只假定「已更新 DB」。
 *
 * 输入:  public/data/shared/events.json（可由 docs/tools/event/event-csv-to-json.cjs 从 CSV 生成）
 * 目标:  config_events 表
 *
 * 用法:
 *   node backend/database/import-events-data.js
 *
 * 注意:
 *   - optionA/optionB 以 JSON 格式存入 option_a/option_b 字段
 *   - 使用 ON DUPLICATE KEY UPDATE，可重复执行
 */

const mysql = require('mysql2/promise');
const fs    = require('fs').promises;
const path  = require('path');
const { purgeAfterConfigImport } = require('./import-config-purge.js');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

/** 与 configService.formatTriggerProbability / 前端 pickRandomEvent 一致：仅 1 入库；否则 NULL（均等池） */
function triggerProbabilityForImport(tp) {
  if (tp == null || tp === '') return null;
  const n = Number(tp);
  if (Number.isFinite(n) && n === 1) return 1;
  return null;
}

const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || '05_san_storm',
  charset:  'utf8mb4',
};

const JSON_PATH = path.join(__dirname, '../../public/data/shared/events.json');

function extractSeasonFromEventId(id) {
  const m = String(id || '').match(/^(san_\d+)/);
  return m ? m[1] : null;
}

async function importEvents(connection) {
  console.log('开始导入事件配置数据...');

  const fileContent = await fs.readFile(JSON_PATH, 'utf8');
  const { events } = JSON.parse(fileContent);

  let imported = 0;
  let skipped  = 0;

  for (const e of events) {
    try {
      const season = (e.season && String(e.season).trim()) || extractSeasonFromEventId(e.id) || 'san_1';
      await connection.query(`
        INSERT INTO config_events (
          event_id, season, event_name, event_hint, location, min_reputation,
          trigger_probability, trigger_context,
          chain_id, chain_level, required_items,
          description_1, description_2, description_3,
          option_a, option_b
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          season              = VALUES(season),
          event_name          = VALUES(event_name),
          event_hint          = VALUES(event_hint),
          location            = VALUES(location),
          min_reputation      = VALUES(min_reputation),
          trigger_probability = VALUES(trigger_probability),
          trigger_context     = VALUES(trigger_context),
          chain_id            = VALUES(chain_id),
          chain_level         = VALUES(chain_level),
          required_items      = VALUES(required_items),
          description_1       = VALUES(description_1),
          description_2       = VALUES(description_2),
          description_3       = VALUES(description_3),
          option_a            = VALUES(option_a),
          option_b            = VALUES(option_b)
      `, [
        e.id,
        season,
        e.name,
        e.eventHint || null,
        e.location || null,
        e.minReputation != null && e.minReputation !== '' ? Number(e.minReputation) : null,
        triggerProbabilityForImport(e.triggerProbability),
        e.triggerContext || null,
        e.chainId || null,
        e.chainLevel || null,
        e.requiredItems || null,
        e.descriptions[0] || null,
        e.descriptions[1] || null,
        e.descriptions[2] || null,
        e.optionA ? JSON.stringify(e.optionA) : null,
        e.optionB ? JSON.stringify(e.optionB) : null,
      ]);

      imported++;
    } catch (err) {
      console.error(`  ❌ 跳过 ${e.id}: ${err.message}`);
      skipped++;
    }
  }

  await purgeAfterConfigImport(connection, events, 'id', {
    table: 'config_events',
    idColumn: 'event_id',
    scopeColumn: 'season',
    label: '事件',
  });

  console.log(`  ✅ 事件: 导入 ${imported} 条，跳过 ${skipped} 条`);
}

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    await importEvents(connection);

    console.log('\n🎉 事件数据导入完成');
  } catch (err) {
    console.error('❌ 导入失败:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
