/**
 * 道具配置数据导入 MySQL
 *
 * 运行时：道具展示名等来自 GET /api/config/items（查 MySQL config_items），非直接读 items.json。
 *
 * 管线：item-template.csv → item-csv-to-json.cjs（**整表重写** JSON）→ public/data/shared/items.json → **本脚本** → config_items。
 *
 * 录入源 CSV: docs/tools/event/item-template.csv（node docs/tools/event/item-csv-to-json.cjs 生成 JSON）
 * 输入:  public/data/shared/items.json
 * 目标:  config_items 表
 *
 * 用法:
 *   node backend/database/import-items-data.js
 *
 * 注意:
 *   - 使用 ON DUPLICATE KEY UPDATE，可重复执行
 *   - 参考 import-events-data.js 的结构
 *   - itemType 含 season_badge / chapter_tactical 前，须已执行对应 migrations
 *     （add-config-items-item-type-season-badge.sql、add-item-pool-and-chapter-tactical.sql）
 */

const mysql = require('mysql2/promise');
const fs    = require('fs').promises;
const path  = require('path');
const { purgeAfterConfigImport } = require('./import-config-purge.js');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || '05_san_storm',
  charset:  'utf8mb4',
};

const JSON_PATH = path.join(__dirname, '../../public/data/shared/items.json');

async function importItems(connection) {
  console.log('开始导入道具配置数据...');

  const fileContent = await fs.readFile(JSON_PATH, 'utf8');
  const { items } = JSON.parse(fileContent);

  let imported = 0;
  let skipped  = 0;

  for (const item of items) {
    try {
      await connection.query(`
        INSERT INTO config_items (
          item_id, item_name, description, item_type, season, special_effect
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          item_name       = VALUES(item_name),
          description     = VALUES(description),
          item_type       = VALUES(item_type),
          season          = VALUES(season),
          special_effect  = VALUES(special_effect)
      `, [
        item.id,
        item.name,
        item.description || null,
        item.itemType || 'event_key',
        item.season || null,
        item.specialEffect || item.special_effect || null,
      ]);

      imported++;
    } catch (err) {
      console.error(`  ❌ 跳过 ${item.id}: ${err.message}`);
      skipped++;
    }
  }

  await purgeAfterConfigImport(connection, items, 'id', {
    table: 'config_items',
    idColumn: 'item_id',
    scopeColumn: 'season',
    label: '道具',
  });

  console.log(`  ✅ 道具: 导入 ${imported} 条，跳过 ${skipped} 条`);
}

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    await importItems(connection);

    console.log('\n🎉 道具数据导入完成');
  } catch (err) {
    console.error('❌ 导入失败:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
