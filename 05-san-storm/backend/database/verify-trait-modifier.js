/**
 * 验证trait_modifier字段
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

async function verifyTraitModifier() {
  let connection;
  
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 查看刘备的完整数据
    const [liubei] = await connection.query(`
      SELECT 
        character_id, character_name, courtesy_name, faction,
        trait, trait_modifier,
        character_extra
      FROM config_characters 
      WHERE character_name = '刘备'
    `);
    
    if (liubei.length > 0) {
      const char = liubei[0];
      console.log('刘备数据示例：');
      console.log(`  ID: ${char.character_id}`);
      console.log(`  姓名: ${char.character_name}`);
      console.log(`  字: ${char.courtesy_name}`);
      console.log(`  势力: ${char.faction}`);
      console.log(`  特性: ${char.trait}`);
      console.log(`  特性修正值: ${char.trait_modifier}`);
      
      const extra = JSON.parse(char.character_extra);
      console.log(`  额外信息:`);
      console.log(`    - 羁绊: ${extra.bonds.join(', ')}`);
      console.log(`    - 传记: ${extra.biography}`);
      console.log(`    - 描述: ${extra.description.substring(0, 50)}...\n`);
    }
    
    // 查看关羽的数据
    const [guanyu] = await connection.query(`
      SELECT 
        character_id, character_name, courtesy_name,
        trait, trait_modifier,
        character_extra
      FROM config_characters 
      WHERE character_name = '关羽'
    `);
    
    if (guanyu.length > 0) {
      const char = guanyu[0];
      console.log('关羽数据示例：');
      console.log(`  ID: ${char.character_id}`);
      console.log(`  姓名: ${char.character_name}`);
      console.log(`  字: ${char.courtesy_name}`);
      console.log(`  特性: ${char.trait}`);
      console.log(`  特性修正值: ${char.trait_modifier}`);
      
      const extra = JSON.parse(char.character_extra);
      console.log(`  额外信息:`);
      console.log(`    - 羁绊: ${extra.bonds.join(', ')}`);
      console.log(`    - 传记: ${extra.biography}\n`);
    }
    
    // 统计trait_modifier分布
    const [stats] = await connection.query(`
      SELECT 
        trait_modifier,
        COUNT(*) as count
      FROM config_characters
      GROUP BY trait_modifier
      ORDER BY trait_modifier DESC
    `);
    
    console.log('特性修正值分布：');
    stats.forEach(s => {
      console.log(`  ${s.trait_modifier}: ${s.count}个将领`);
    });
    
    console.log('\n🎉 验证完成！');
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行验证
verifyTraitModifier();
