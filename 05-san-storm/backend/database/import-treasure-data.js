/**
 * 宝物配置导入 MySQL
 * 输入: public/data/shared/treasures.json → config_treasures
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

const JSON_PATH = path.join(__dirname, '../../public/data/shared/treasures.json');

const BONUS_KEY_TO_FIELD = {
  luck: 'luck_bonus',
  courage: 'courage_bonus',
  combat: 'combat_bonus',
  command: 'command_bonus',
  intelligence: 'intelligence_bonus',
  politics: 'politics_bonus',
  charm: 'charm_bonus',
};

async function importTreasures(connection) {
  console.log('开始导入宝物配置...');
  const fileContent = await fs.readFile(JSON_PATH, 'utf8');
  const { treasures } = JSON.parse(fileContent);

  let imported = 0;
  let skipped = 0;

  for (const item of treasures) {
    try {
      const bonusFields = {
        luck_bonus: 0,
        courage_bonus: 0,
        combat_bonus: 0,
        command_bonus: 0,
        intelligence_bonus: 0,
        politics_bonus: 0,
        charm_bonus: 0,
      };
      if (Array.isArray(item.bonus)) {
        for (const b of item.bonus) {
          const field = BONUS_KEY_TO_FIELD[b.key];
          if (field) bonusFields[field] = b.value;
        }
      }
      const specialEffect = item.specialEffect
        ? JSON.stringify({ raw: item.specialEffect })
        : null;

      await connection.query(
        `INSERT INTO config_treasures (
          treasure_id, season, treasure_name, series,
          luck_bonus, courage_bonus, combat_bonus, command_bonus,
          intelligence_bonus, politics_bonus, charm_bonus,
          special_effect, special_effect_desc, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          season = VALUES(season),
          treasure_name = VALUES(treasure_name),
          series = VALUES(series),
          luck_bonus = VALUES(luck_bonus),
          courage_bonus = VALUES(courage_bonus),
          combat_bonus = VALUES(combat_bonus),
          command_bonus = VALUES(command_bonus),
          intelligence_bonus = VALUES(intelligence_bonus),
          politics_bonus = VALUES(politics_bonus),
          charm_bonus = VALUES(charm_bonus),
          special_effect = VALUES(special_effect),
          special_effect_desc = VALUES(special_effect_desc),
          description = VALUES(description)`,
        [
          item.id,
          item.season,
          item.name,
          item.series || null,
          bonusFields.luck_bonus,
          bonusFields.courage_bonus,
          bonusFields.combat_bonus,
          bonusFields.command_bonus,
          bonusFields.intelligence_bonus,
          bonusFields.politics_bonus,
          bonusFields.charm_bonus,
          specialEffect,
          item.specialEffectDesc || null,
          item.description || '',
        ],
      );
      imported += 1;
    } catch (err) {
      console.error(`  ❌ 跳过 ${item.id}: ${err.message}`);
      skipped += 1;
    }
  }

  await purgeAfterConfigImport(connection, treasures, 'id', {
    table: 'config_treasures',
    idColumn: 'treasure_id',
    scopeColumn: 'season',
    label: '宝物',
  });

  console.log(`  ✅ 宝物: 导入 ${imported} 条，跳过 ${skipped} 条`);
}

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    await importTreasures(connection);
    console.log('\n🎉 宝物数据导入完成');
  } catch (err) {
    console.error('❌ 导入失败:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
