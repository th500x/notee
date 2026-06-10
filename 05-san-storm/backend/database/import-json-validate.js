/**
 * import-all / 各 import-*.js 共用的 JSON 源校验（存在、可解析、主键不重复）
 */

const fs = require('fs').promises;
const path = require('path');

const SHARED = path.join(__dirname, '../../public/data/shared');

/** @type {Array<{ file: string, label: string, arrayKey?: string|null, rootArray?: boolean, idKey?: string }>} */
const IMPORT_JSON_SOURCES = [
  { file: 'characters.json', label: '将领', arrayKey: 'characters', idKey: 'id' },
  { file: 'troops.json', label: '部队', arrayKey: 'troops', idKey: 'id' },
  { file: 'positions.json', label: '官职', arrayKey: 'positions', idKey: 'id' },
  { file: 'factions.json', label: '势力', arrayKey: 'factions', idKey: 'id' },
  { file: 'titles.json', label: '称号', arrayKey: 'titles', idKey: 'id' },
  { file: 'achievements.json', label: '成就', arrayKey: 'achievements', idKey: 'id' },
  { file: 'skills.json', label: '技能', arrayKey: 'skills', idKey: 'id' },
  { file: 'bonds.json', label: '羁绊', rootArray: true, idKey: 'id' },
  { file: 'equipment.json', label: '装备', arrayKey: 'equipment', idKey: 'id' },
  { file: 'treasures.json', label: '宝物', arrayKey: 'treasures', idKey: 'id' },
  { file: 'events.json', label: '事件', arrayKey: 'events', idKey: 'id' },
  { file: 'campaigns.json', label: '战役', arrayKey: 'campaigns', idKey: 'campaign_id' },
  { file: 'items.json', label: '道具', arrayKey: 'items', idKey: 'id' },
  { file: 'config_zhou.json', label: '州', arrayKey: 'zhou', idKey: 'zhouId' },
  { file: 'config_jun.json', label: '郡', arrayKey: 'jun', idKey: 'junId' },
  { file: 'cities_seed.json', label: '城市种子', arrayKey: 'cities', idKey: 'cityId' },
];

/**
 * @param {unknown} data
 * @param {{ arrayKey?: string|null, rootArray?: boolean, idKey?: string, label: string }} spec
 */
function extractRows(data, spec) {
  if (spec.rootArray) {
    if (!Array.isArray(data)) {
      throw new Error(`${spec.label}: 根节点须为数组`);
    }
    return data;
  }
  const key = spec.arrayKey;
  if (!key) throw new Error(`${spec.label}: 未配置 arrayKey`);
  const rows = data?.[key];
  if (!Array.isArray(rows)) {
    throw new Error(`${spec.label}: 缺少数组字段 ${key}`);
  }
  return rows;
}

/**
 * @param {object[]} rows
 * @param {string} idKey
 * @param {string} label
 */
function assertUniqueIds(rows, idKey, label) {
  const seen = new Set();
  for (const row of rows) {
    const id = row[idKey] ?? row.id;
    if (id == null || String(id).trim() === '') {
      throw new Error(`${label}: 存在缺少 ${idKey} 的行`);
    }
    const s = String(id).trim();
    if (seen.has(s)) {
      throw new Error(`${label}: 重复 ${idKey} = ${s}`);
    }
    seen.add(s);
  }
}

/**
 * @param {{ file: string, label: string, arrayKey?: string|null, rootArray?: boolean, idKey?: string }} spec
 */
async function validateImportJsonSource(spec) {
  const filePath = path.join(SHARED, spec.file);
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    throw new Error(`${spec.label}: 找不到 JSON ${spec.file}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${spec.label}: JSON 解析失败 (${spec.file}) — ${e.message}`);
  }
  const rows = extractRows(data, spec);
  if (rows.length === 0) {
    console.warn(`⚠️ ${spec.label}: ${spec.file} 为空数组，导入后将清理对应 season/前缀范围内全部旧配置`);
  }
  assertUniqueIds(rows, spec.idKey || 'id', spec.label);
  return { spec, count: rows.length };
}

/**
 * @param {string[]|null} [onlyFiles] basenames，如 ['achievements.json']；null = 全部
 */
async function validateAllImportJsonSources(onlyFiles = null) {
  const list = onlyFiles
    ? IMPORT_JSON_SOURCES.filter((s) => onlyFiles.includes(s.file))
    : IMPORT_JSON_SOURCES;

  console.log('📋 校验 JSON 配置源…');
  for (const spec of list) {
    const { count } = await validateImportJsonSource(spec);
    console.log(`  ✓ ${spec.label} (${spec.file}): ${count} 条`);
  }
  console.log('');
}

module.exports = {
  IMPORT_JSON_SOURCES,
  SHARED,
  validateImportJsonSource,
  validateAllImportJsonSources,
  extractRows,
  assertUniqueIds,
};
