/**
 * 数据迁移脚本
 * 从JSON文件迁移到MySQL数据库
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const { pool, testConnection } = require('./connection');

// JSON文件路径
const JSON_FILE = path.join(__dirname, '../data/rental-tracking.json');

/**
 * 读取JSON文件
 */
function readJsonFile() {
  try {
    if (!fs.existsSync(JSON_FILE)) {
      console.log('⚠️  JSON文件不存在，跳过迁移');
      return null;
    }
    
    const data = fs.readFileSync(JSON_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ 读取JSON文件失败:', error.message);
    return null;
  }
}

/**
 * 迁移单个项目
 */
async function migrateProject(project) {
  const sql = `
    INSERT INTO projects (
      id, name, description, password, visible,
      properties, property_groups, expenses, version,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      description = VALUES(description),
      password = VALUES(password),
      visible = VALUES(visible),
      properties = VALUES(properties),
      property_groups = VALUES(property_groups),
      expenses = VALUES(expenses),
      version = VALUES(version) + 1,
      updated_at = CURRENT_TIMESTAMP
  `;
  
  const params = [
    project.id,
    project.name,
    project.description || null,
    project.password || null,
    project.visible !== false,
    JSON.stringify(project.properties || []),
    JSON.stringify(project.propertyGroups || {}),
    JSON.stringify(project.expenses || []),
    project.version || 1,
    project.createdAt || new Date().toISOString(),
    project.updatedAt || new Date().toISOString()
  ];
  
  try {
    const [result] = await pool.execute(sql, params);
    return result;
  } catch (error) {
    console.error(`❌ 迁移项目失败 [${project.id}]:`, error.message);
    throw error;
  }
}

/**
 * 执行迁移
 */
async function migrate() {
  console.log('========================================');
  console.log('开始数据迁移');
  console.log('========================================');
  console.log();
  
  // 测试数据库连接
  const connected = await testConnection();
  if (!connected) {
    console.log('❌ 数据库连接失败，迁移中止');
    process.exit(1);
  }
  
  console.log();
  
  // 读取JSON数据
  console.log('[1] 读取JSON文件...');
  const jsonData = readJsonFile();
  
  if (!jsonData || !jsonData.projects || jsonData.projects.length === 0) {
    console.log('⚠️  没有数据需要迁移');
    await pool.end();
    return;
  }
  
  console.log(`✅ 找到 ${jsonData.projects.length} 个项目`);
  console.log();
  
  // 迁移数据
  console.log('[2] 迁移数据到MySQL...');
  let successCount = 0;
  let failCount = 0;
  
  for (const project of jsonData.projects) {
    try {
      await migrateProject(project);
      console.log(`✅ ${project.name} (${project.id})`);
      successCount++;
    } catch (error) {
      console.log(`❌ ${project.name} (${project.id})`);
      failCount++;
    }
  }
  
  console.log();
  console.log('========================================');
  console.log('迁移完成');
  console.log('========================================');
  console.log(`✅ 成功: ${successCount} 个项目`);
  if (failCount > 0) {
    console.log(`❌ 失败: ${failCount} 个项目`);
  }
  console.log();
  
  // 验证迁移结果
  console.log('[3] 验证迁移结果...');
  const [rows] = await pool.execute('SELECT id, name, visible FROM projects');
  console.log(`📊 数据库中共有 ${rows.length} 个项目:`);
  rows.forEach(row => {
    console.log(`   - ${row.name} (${row.id}) ${row.visible ? '✓' : '✗'}`);
  });
  
  console.log();
  console.log('✅ 数据迁移成功！');
  console.log();
  
  // 关闭连接
  await pool.end();
}

// 执行迁移
if (require.main === module) {
  migrate().catch(error => {
    console.error('迁移失败:', error);
    process.exit(1);
  });
}

module.exports = { migrate };

