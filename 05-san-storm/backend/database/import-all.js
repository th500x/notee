/**
 * 一键导入所有JSON配置数据到MySQL
 *
 * 用法（建议 cwd 为 backend/）:
 *   node database/import-all.js
 * 或从仓库根:
 *   node 05-san-storm/backend/database/import-all.js
 *
 * 按依赖顺序执行：
 *   1. 配置数据（将领、部队、官职、势力；将领/势力 season 来自 *_id / JSON，非 CSV 列）
 *   1b. 州 / 郡 / 城市种子（import-city-geo-data.js → config_zhou、config_jun、cities）
 *       前置：已执行 migrations/create-config-zhou-jun.sql；cities.faction_id 外键要求运行时表 factions
 *       中已存在 cities_seed.json 里用到的每个 initialFactionId（import-config-data 只写 config_factions，
 *       不写入 factions；若库中尚无对应 factions 行，本步会外键失败，须先用势力运行时初始化或其它脚本补全）
 *   2. 技能和羁绊（skills.json + bonds.json；羁绊含 season，写入 config_bonds.season）
 *   3. 装备
 *   4. 事件（events.json 含 season，写入 config_events.season）
 *   5. 战役卡片
 *   6. 道具（import-items-data.js → config_items）
 *
 * 注意：
 *   - 不包含服务器初始化（init-servers.js），需单独执行
 *   - 执行前请确保已运行所有迁移脚本（backend/database/migrations/）
 *   - 技能：public/data/shared/skills.json（按需运行对应 CSV→JSON）
 *   - 羁绊：docs/tools/bond/bond-csv-to-json.cjs → public/data/shared/bonds.json（列与 bond-template.csv 一致）
 *   - 事件：docs/tools/event/event-csv-to-json.cjs → public/data/shared/events.json（列与 event-template.csv 一致）
 *   - config_bonds / config_events 须有 season 列（见 migrations/add-config-bonds-season-column.sql、
 *     add-config-events-season-column.sql）
 *   - 道具含 itemType=season_badge（如 item_badge）时，须已应用 migrations/add-config-items-item-type-season-badge.sql
 *     扩展 config_items.item_type，否则该条导入会被 MySQL 拒绝、脚本计为「跳过」
 */

const { execFileSync } = require('child_process');
const path = require('path');

const DB_DIR = __dirname;

const scripts = [
  { name: '配置数据（将领/部队/官职/势力）', file: 'import-config-data.js' },
  { name: '州郡城市（zhou/jun/cities 种子 JSON）', file: 'import-city-geo-data.js' },
  { name: '技能和羁绊', file: 'import-skills-bonds.js' },
  { name: '装备', file: 'import-equipment-data.js' },
  { name: '事件', file: 'import-events-data.js' },
  { name: '战役卡片', file: 'import-campaigns-data.js' },
  { name: '道具', file: 'import-items-data.js' },
];

console.log('🚀 开始一键导入所有配置数据...\n');

let success = 0;
let failed = 0;

const backendDir = path.resolve(DB_DIR, '..');

for (const s of scripts) {
  const scriptPath = path.join(DB_DIR, s.file);
  console.log(`── ${s.name} ──`);
  try {
    execFileSync(process.execPath, [scriptPath], { stdio: 'inherit', cwd: backendDir });
    success++;
    console.log('');
  } catch (err) {
    failed++;
    console.error(`❌ ${s.name} 导入失败\n`);
  }
}

console.log(`\n🏁 导入完成: ${success} 成功, ${failed} 失败`);
if (failed > 0) process.exit(1);
