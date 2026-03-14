/**
 * 检查数据库表状态
 * - 统计已建立的表数量
 * - 统计有数据的表数量
 * - 显示每个表的记录数
 */

import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: '05_san_storm',
};

async function checkTablesStatus() {
  let connection;
  
  try {
    console.log('📦 连接数据库...\n');
    connection = await mysql.createConnection(dbConfig);
    
    // 1. 获取所有表
    console.log('📊 查询所有表...\n');
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    console.log(`✅ 数据库中共有 ${tableNames.length} 张表\n`);
    console.log('='.repeat(80));
    
    // 2. 统计每个表的记录数
    const tableStats = [];
    let tablesWithData = 0;
    let totalRecords = 0;
    
    for (const tableName of tableNames) {
      const [result] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      const count = result[0].count;
      
      tableStats.push({
        name: tableName,
        count: count
      });
      
      if (count > 0) {
        tablesWithData++;
        totalRecords += count;
      }
    }
    
    // 3. 按记录数排序并显示
    tableStats.sort((a, b) => b.count - a.count);
    
    console.log('\n表名'.padEnd(40) + '记录数');
    console.log('-'.repeat(80));
    
    tableStats.forEach(stat => {
      const status = stat.count > 0 ? '✅' : '⚪';
      const countStr = stat.count.toLocaleString();
      console.log(`${status} ${stat.name.padEnd(38)} ${countStr.padStart(10)}`);
    });
    
    console.log('='.repeat(80));
    console.log(`\n📈 统计摘要：`);
    console.log(`   总表数：${tableNames.length} 张`);
    console.log(`   有数据的表：${tablesWithData} 张 (${((tablesWithData/tableNames.length)*100).toFixed(1)}%)`);
    console.log(`   空表：${tableNames.length - tablesWithData} 张`);
    console.log(`   总记录数：${totalRecords.toLocaleString()} 条\n`);
    
    // 4. 分类显示
    console.log('📋 表分类：\n');
    
    const categories = {
      '配置表 (config_*)': tableStats.filter(t => t.name.startsWith('config_')),
      '玩家表 (players*)': tableStats.filter(t => t.name.startsWith('players') || t.name === 'player_equipment_slots'),
      '游戏数据表': tableStats.filter(t => !t.name.startsWith('config_') && !t.name.startsWith('players') && t.name !== 'player_equipment_slots')
    };
    
    for (const [category, tables] of Object.entries(categories)) {
      if (tables.length > 0) {
        const withData = tables.filter(t => t.count > 0).length;
        console.log(`${category}: ${tables.length} 张表，${withData} 张有数据`);
        tables.forEach(t => {
          const status = t.count > 0 ? '✅' : '⚪';
          console.log(`  ${status} ${t.name} (${t.count.toLocaleString()} 条)`);
        });
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkTablesStatus();
