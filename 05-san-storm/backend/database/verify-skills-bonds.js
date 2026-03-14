/**
 * 验证技能和羁绊配置表
 */

const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: '05_san_storm',
  charset: 'utf8mb4'
};

async function verify() {
  let connection;
  
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 验证技能配置表
    console.log('=== 技能配置表 (config_skills) ===');
    const [skills] = await connection.query(`
      SELECT skill_id, skill_name, skill_type, rarity 
      FROM config_skills 
      LIMIT 5
    `);
    console.log('示例数据：');
    console.table(skills);
    
    const [skillStats] = await connection.query(`
      SELECT skill_type, COUNT(*) as count 
      FROM config_skills 
      GROUP BY skill_type
    `);
    console.log('技能类型分布：');
    console.table(skillStats);
    console.log('');
    
    // 验证羁绊配置表
    console.log('=== 羁绊配置表 (config_bonds) ===');
    const [bonds] = await connection.query(`
      SELECT bond_id, bond_name, bond_type, rarity 
      FROM config_bonds 
      LIMIT 5
    `);
    console.log('示例数据：');
    console.table(bonds);
    
    const [bondStats] = await connection.query(`
      SELECT bond_type, COUNT(*) as count 
      FROM config_bonds 
      GROUP BY bond_type
    `);
    console.log('羁绊类型分布：');
    console.table(bondStats);
    console.log('');
    
    // 总结
    const [skillCount] = await connection.query('SELECT COUNT(*) as count FROM config_skills');
    const [bondCount] = await connection.query('SELECT COUNT(*) as count FROM config_bonds');
    
    console.log('=== 验证总结 ===');
    console.log(`技能配置表：${skillCount[0].count} 条数据`);
    console.log(`羁绊配置表：${bondCount[0].count} 条数据`);
    console.log('\n✅ 技能和羁绊配置表验证通过！');
    
  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

verify();

