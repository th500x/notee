/**
 * 探险主题 JSON → config_adventure_themes
 * 用法: node backend/database/import-adventure-themes-data.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { purgeAfterConfigImport } = require('./import-config-purge.js');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '05_san_storm',
  charset: 'utf8mb4',
};

const JSON_PATH = path.join(__dirname, '../../public/data/shared/adventureThemes.json');

async function importThemes(connection) {
  console.log('开始导入探险主题…');
  const fileContent = await fs.readFile(JSON_PATH, 'utf8');
  const { themes } = JSON.parse(fileContent);
  let imported = 0;
  let skipped = 0;

  for (const t of themes || []) {
    try {
      await connection.query(
        `INSERT INTO config_adventure_themes (
          theme_id, season, theme_name, tone, description, duration_hours,
          encounter_rate, enemy_tier,
          reward_silver_min, reward_silver_max, reward_food_min, reward_food_max,
          sort_order, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          season = VALUES(season),
          theme_name = VALUES(theme_name),
          tone = VALUES(tone),
          description = VALUES(description),
          duration_hours = VALUES(duration_hours),
          encounter_rate = VALUES(encounter_rate),
          enemy_tier = VALUES(enemy_tier),
          reward_silver_min = VALUES(reward_silver_min),
          reward_silver_max = VALUES(reward_silver_max),
          reward_food_min = VALUES(reward_food_min),
          reward_food_max = VALUES(reward_food_max),
          sort_order = VALUES(sort_order),
          is_active = VALUES(is_active)`,
        [
          t.id,
          t.season || 'san_1',
          t.name,
          t.tone || 'patrol',
          t.description || null,
          t.durationHours ?? 4,
          t.encounterRate ?? 0,
          t.enemyTier || 'normal',
          t.rewardSilverMin ?? 0,
          t.rewardSilverMax ?? 0,
          t.rewardFoodMin ?? 0,
          t.rewardFoodMax ?? 0,
          t.sortOrder ?? 0,
          t.isActive === false ? 0 : 1,
        ],
      );
      imported += 1;
    } catch (err) {
      console.error(`  跳过 ${t.id}: ${err.message}`);
      skipped += 1;
    }
  }

  await purgeAfterConfigImport(connection, themes || [], 'id', {
    table: 'config_adventure_themes',
    idColumn: 'theme_id',
    scopeColumn: 'season',
    label: '探险主题',
  });

  console.log(`  探险主题: 导入 ${imported} 条，跳过 ${skipped} 条`);
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    await importThemes(connection);
    console.log('探险主题导入完成');
  } finally {
    await connection.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
