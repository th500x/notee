/**
 * 数据库迁移脚本：为config_skills表添加troop_type字段
 * 
 * @description 添加兵种类型字段，用于限制技能只能被特定兵种使用
 * @date 2026-03-11
 */

require('dotenv').config({ path: __dirname + '/../../.env' });
const { pool } = require('../connection');

async function migrate() {
  console.log('========================================');
  console.log('⚔️  数据库迁移：添加troop_type字段');
  console.log('========================================\n');
  
  try {
    // 1. 检查字段是否已存在
    console.log('📊 检查字段是否已存在...');
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '05_san_storm' 
        AND TABLE_NAME = 'config_skills' 
        AND COLUMN_NAME = 'troop_type'
    `);
    
    if (columns.length > 0) {
      console.log('⚠️  字段 troop_type 已存在，跳过迁移\n');
      process.exit(0);
    }
    
    // 2. 添加troop_type字段
    console.log('📝 添加 troop_type 字段...');
    await pool.query(`
      ALTER TABLE config_skills 
      ADD COLUMN troop_type VARCHAR(100) NULL COMMENT '兵种类型限制（infantry/cavalry/archer，支持多兵种用分号分隔）' 
      AFTER character_type
    `);
    console.log('✅ 字段添加成功\n');
    
    // 3. 验证字段
    console.log('🔍 验证字段...');
    const [newColumns] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '05_san_storm' 
        AND TABLE_NAME = 'config_skills' 
        AND COLUMN_NAME = 'troop_type'
    `);
    
    if (newColumns.length > 0) {
      console.log('✅ 字段验证成功:');
      console.log(`   字段名: ${newColumns[0].COLUMN_NAME}`);
      console.log(`   类型: ${newColumns[0].COLUMN_TYPE}`);
      console.log(`   可空: ${newColumns[0].IS_NULLABLE}`);
      console.log(`   注释: ${newColumns[0].COLUMN_COMMENT}`);
    }
    
    console.log('\n========================================');
    console.log('✅ 迁移完成！');
    console.log('========================================\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ 迁移失败:', error.message);
    console.error('========================================\n');
    process.exit(1);
  }
}

// 运行迁移
migrate();
