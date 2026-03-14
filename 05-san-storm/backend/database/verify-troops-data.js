/**
 * 验证数据库和JSON文件的部队数据是否一致
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: '05_san_storm',
  charset: 'utf8mb4'
};

async function verifyTroopsData() {
  let connection;
  
  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ 数据库连接成功');
    
    // 读取JSON文件
    const jsonPath = path.join(__dirname, '../../public/data/shared/troops.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const jsonTroops = jsonData.troops;
    console.log(`✓ JSON文件读取成功，共 ${jsonTroops.length} 个部队`);
    
    // 查询数据库
    const [dbTroops] = await connection.execute(
      'SELECT * FROM config_troops ORDER BY troop_id'
    );
    console.log(`✓ 数据库查询成功，共 ${dbTroops.length} 个部队\n`);
    
    // 检查数量是否一致
    if (jsonTroops.length !== dbTroops.length) {
      console.error(`❌ 数量不一致！JSON: ${jsonTroops.length}, 数据库: ${dbTroops.length}`);
      return false;
    }
    
    // 创建数据库数据映射
    const dbTroopsMap = {};
    dbTroops.forEach(troop => {
      dbTroopsMap[troop.troop_id] = troop;
    });
    
    // 逐个对比
    let allMatch = true;
    let mismatchCount = 0;
    
    for (const jsonTroop of jsonTroops) {
      const dbTroop = dbTroopsMap[jsonTroop.id];
      
      if (!dbTroop) {
        console.error(`❌ 数据库中找不到部队: ${jsonTroop.id} (${jsonTroop.name})`);
        allMatch = false;
        mismatchCount++;
        continue;
      }
      
      // 对比关键字段
      const fieldsToCheck = [
        { json: 'name', db: 'troop_name', transform: null },
        { json: 'rarity', db: 'rarity', transform: null },
        { json: 'troopType', db: 'troop_type', transform: null },
        { json: 'weaponType', db: 'weapon_type', transform: null },
        { json: 'range', db: 'attack_range', transform: null },
        { json: 'attack', db: 'attack', transform: 'multiply10' },  // 数据库×10存储
        { json: 'defense', db: 'defense', transform: 'multiply10' }, // 数据库×10存储
        { json: 'speed', db: 'speed', transform: null },
        { json: 'movement', db: 'movement', transform: null },
        { json: 'maxTroops', db: 'max_troops', transform: null }
      ];
      
      let troopMatch = true;
      const mismatches = [];
      
      for (const field of fieldsToCheck) {
        let jsonValue = jsonTroop[field.json];
        let dbValue = dbTroop[field.db];
        
        // 应用转换
        if (field.transform === 'multiply10') {
          jsonValue = jsonValue * 10;  // JSON值×10后与数据库比较
        }
        
        // 处理null和空字符串的情况
        const jsonNormalized = jsonValue === '' || jsonValue === null ? null : jsonValue;
        const dbNormalized = dbValue === '' || dbValue === null ? null : dbValue;
        
        if (jsonNormalized !== dbNormalized) {
          troopMatch = false;
          mismatches.push({
            field: field.json,
            json: jsonNormalized,
            db: dbNormalized
          });
        }
      }
      
      if (!troopMatch) {
        console.error(`\n❌ 部队数据不一致: ${jsonTroop.id} (${jsonTroop.name})`);
        mismatches.forEach(m => {
          console.error(`   ${m.field}: JSON="${m.json}" vs DB="${m.db}"`);
        });
        allMatch = false;
        mismatchCount++;
      }
    }
    
    // 输出结果
    console.log('\n' + '='.repeat(60));
    if (allMatch) {
      console.log('✓ 验证通过！数据库和JSON文件的数据完全一致');
      console.log(`  共验证 ${jsonTroops.length} 个部队，全部匹配`);
    } else {
      console.error(`❌ 验证失败！发现 ${mismatchCount} 个不一致的部队`);
      console.error('   请检查上述错误信息');
    }
    console.log('='.repeat(60));
    
    return allMatch;
    
  } catch (error) {
    console.error('❌ 验证过程出错:', error.message);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行验证
verifyTroopsData()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
