/**
 * 事件配置数据导入 MySQL
 *
 * 输入:  public/data/shared/events.json
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

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || '05_san_storm',
  charset:  'utf8mb4',
};

const JSON_PATH = path.join(__dirname, '../../public/data/shared/events.json');

async function importEvents(connection) {
  console.log('开始导入事件配置数据...');

  const fileContent = await fs.readFile(JSON_PATH, 'utf8');
  const { events } = JSON.parse(fileContent);

  let imported = 0;
  let skipped  = 0;

  for (const e of events) {
    try {
      await connection.query(`
        INSERT INTO config_events (
          event_id, event_name, location, min_position_level,
          trigger_probability, trigger_context,
          chain_id, chain_level, required_items,
          description_1, description_2, description_3,
          option_a, option_b, tags, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          event_name          = VALUES(event_name),
          location            = VALUES(location),
          min_position_level  = VALUES(min_position_level),
          trigger_probability = VALUES(trigger_probability),
          trigger_context     = VALUES(trigger_context),
          chain_id            = VALUES(chain_id),
          chain_level         = VALUES(chain_level),
          required_items      = VALUES(required_items),
          description_1       = VALUES(description_1),
          description_2       = VALUES(description_2),
          description_3       = VALUES(description_3),
          option_a            = VALUES(option_a),
          option_b            = VALUES(option_b),
          tags                = VALUES(tags),
          version             = VALUES(version)
      `, [
        e.id,
        e.name,
        e.location || null,
        e.minPositionLevel || null,
        e.triggerProbability,
        e.triggerContext || null,
        e.chainId || null,
        e.chainLevel || null,
        e.requiredItems || null,
        e.descriptions[0] || null,
        e.descriptions[1] || null,
        e.descriptions[2] || null,
        e.optionA ? JSON.stringify(e.optionA) : null,
        e.optionB ? JSON.stringify(e.optionB) : null,
        e.tags || null,
        e.version || '1.0',
      ]);

      imported++;
    } catch (err) {
      console.error(`  ❌ 跳过 ${e.id}: ${err.message}`);
      skipped++;
    }
  }

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
