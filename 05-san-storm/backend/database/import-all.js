/**
 * 一键导入所有JSON配置数据到MySQL
 * 
 * 用法: node backend/database/import-all.js
 * 
 * 按依赖顺序执行：
 *   1. 配置数据（将领、部队、官职、势力等）
 *   2. 技能和羁绊
 *   3. 装备
 *   4. 事件
 *   5. 道具
 * 
 * 注意：不包含服务器初始化（init-servers.js），需单独执行
 */

const { execSync } = require('child_process');
const path = require('path');

const DB_DIR = __dirname;

const scripts = [
  { name: '配置数据（将领/部队/官职/势力）', file: 'import-config-data.js' },
  { name: '技能和羁绊', file: 'import-skills-bonds.js' },
  { name: '装备', file: 'import-equipment-data.js' },
  { name: '事件', file: 'import-events-data.js' },
  { name: '道具', file: 'import-items-data.js' },
];

console.log('🚀 开始一键导入所有配置数据...\n');

let success = 0;
let failed = 0;

for (const s of scripts) {
  const scriptPath = path.join(DB_DIR, s.file);
  console.log(`── ${s.name} ──`);
  try {
    execSync(`node "${scriptPath}"`, { stdio: 'inherit', cwd: path.resolve(DB_DIR, '..') });
    success++;
    console.log('');
  } catch (err) {
    failed++;
    console.error(`❌ ${s.name} 导入失败\n`);
  }
}

console.log(`\n🏁 导入完成: ${success} 成功, ${failed} 失败`);
if (failed > 0) process.exit(1);
