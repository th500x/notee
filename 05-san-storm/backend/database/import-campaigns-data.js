/**
 * 战役卡片配置导入 MySQL（config_campaigns）
 *
 * 输入:  public/data/shared/campaigns.json（由 campaign-csv-to-json.cjs 生成）
 *
 * 用法:
 *   node backend/database/import-campaigns-data.js
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

const JSON_PATH = path.join(__dirname, '../../public/data/shared/campaigns.json');

async function importCampaigns(connection) {
  console.log('开始导入战役卡片配置...');

  let raw;
  try {
    raw = await fs.readFile(JSON_PATH, 'utf8');
  } catch (e) {
    console.error('❌ 找不到 JSON，请先运行: node docs/tools/campaign/campaign-csv-to-json.cjs');
    throw e;
  }

  const data = JSON.parse(raw);
  const list = data.campaigns || [];
  let imported = 0;
  let skipped = 0;

  for (const c of list) {
    try {
      await connection.query(
        `
        INSERT INTO config_campaigns (
          campaign_id, season, campaign_name, campaign_type, era, faction,
          max_rounds, min_rounds, completion_reward_silver, completion_reward_food, completion_reward_badge,
          description_1, description_2, description_3,
          sort_order, enabled, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          season = VALUES(season),
          campaign_name = VALUES(campaign_name),
          campaign_type = VALUES(campaign_type),
          era = VALUES(era),
          faction = VALUES(faction),
          max_rounds = VALUES(max_rounds),
          min_rounds = VALUES(min_rounds),
          completion_reward_silver = VALUES(completion_reward_silver),
          completion_reward_food = VALUES(completion_reward_food),
          completion_reward_badge = VALUES(completion_reward_badge),
          description_1 = VALUES(description_1),
          description_2 = VALUES(description_2),
          description_3 = VALUES(description_3),
          sort_order = VALUES(sort_order),
          enabled = VALUES(enabled),
          version = VALUES(version)
      `,
        [
          c.campaign_id,
          c.season,
          c.campaign_name,
          c.campaign_type,
          c.era,
          c.faction,
          c.max_rounds,
          c.min_rounds,
          c.completion_reward_silver,
          c.completion_reward_food,
          c.completion_reward_badge ?? null,
          c.description_1,
          c.description_2,
          c.description_3,
          c.sort_order ?? 0,
          c.enabled !== undefined ? c.enabled : 1,
          c.version || '1.0',
        ]
      );
      imported++;
    } catch (err) {
      console.error(`  ❌ 跳过 ${c.campaign_id}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`  ✅ 战役卡片: 导入 ${imported} 条，跳过 ${skipped} 条`);
}

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    await importCampaigns(connection);

    console.log('\n🎉 战役卡片导入完成');
  } catch (err) {
    console.error('❌ 导入失败:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
