/**
 * 装备件配置数据导入 MySQL
 *
 * 输入:  public/data/shared/equipment.json
 * 目标:  config_equipment 表
 *
 * 用法:
 *   node backend/database/import-equipment-data.js
 *
 * 注意:
 *   - bonus 数组在 JSON 中已是 ×10 存储值，直接写入对应字段
 *   - special_effect 字符串原样写入（CSV 标记语言格式）
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

const JSON_PATH = path.join(__dirname, '../../public/data/shared/equipment.json');

// bonus key → db 字段名映射
const BONUS_KEY_TO_FIELD = {
  luck:         'luck_bonus',
  courage:      'courage_bonus',
  combat:       'combat_bonus',
  command:      'command_bonus',
  intelligence: 'intelligence_bonus',
  politics:     'politics_bonus',
  charm:        'charm_bonus',
};

async function importEquipment(connection) {
  console.log('开始导入装备件配置数据...');

  const fileContent = await fs.readFile(JSON_PATH, 'utf8');
  const { equipment } = JSON.parse(fileContent);

  let imported = 0;
  let skipped  = 0;

  for (const item of equipment) {
    try {
      // 将 bonus 数组展开为各字段
      const bonusFields = {
        luck_bonus:         0,
        courage_bonus:      0,
        combat_bonus:       0,
        command_bonus:      0,
        intelligence_bonus: 0,
        politics_bonus:     0,
        charm_bonus:        0,
      };

      if (Array.isArray(item.bonus)) {
        for (const b of item.bonus) {
          const field = BONUS_KEY_TO_FIELD[b.key];
          if (field) bonusFields[field] = b.value; // 已是 ×10 值
        }
      }

      // special_effect: CSV 标记语言字符串 → 存为 JSON null 或字符串
      // 数据库字段是 JSON 类型，存字符串时需包装
      const specialEffect = item.specialEffect
        ? JSON.stringify({ raw: item.specialEffect })
        : null;

      await connection.query(`
        INSERT INTO config_equipment (
          equipment_id, season, equipment_name,
          luck_bonus, courage_bonus, combat_bonus, command_bonus,
          intelligence_bonus, politics_bonus, charm_bonus,
          special_effect, special_effect_desc, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          season               = VALUES(season),
          equipment_name       = VALUES(equipment_name),
          luck_bonus           = VALUES(luck_bonus),
          courage_bonus        = VALUES(courage_bonus),
          combat_bonus         = VALUES(combat_bonus),
          command_bonus        = VALUES(command_bonus),
          intelligence_bonus   = VALUES(intelligence_bonus),
          politics_bonus       = VALUES(politics_bonus),
          charm_bonus          = VALUES(charm_bonus),
          special_effect       = VALUES(special_effect),
          special_effect_desc  = VALUES(special_effect_desc),
          description          = VALUES(description)
      `, [
        item.id,
        item.season,
        item.name,
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
      ]);

      imported++;
    } catch (err) {
      console.error(`  ❌ 跳过 ${item.id}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`  ✅ 装备件: 导入 ${imported} 条，跳过 ${skipped} 条`);
}

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    await importEquipment(connection);

    console.log('\n🎉 装备件数据导入完成');
  } catch (err) {
    console.error('❌ 导入失败:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
