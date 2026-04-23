/**
 * 按合并图（及颍川阶段一回退约定）幂等补全 `bandits` 表。
 * cwd = backend:
 *   node scripts/sync-bandits-from-merged-map.js
 * 可选：指定合并图绝对路径（与 worldmap-merge --out 一致时）
 *   node scripts/sync-bandits-from-merged-map.js "D:/.../san_1_jun_yingchuan_merged.json"
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { syncBanditsFromYingchuanMergedDisk } = require('../services/banditInstanceService');

(async () => {
  const arg = process.argv[2];
  const opts = arg && String(arg).trim() ? { mergedAbsPath: path.resolve(arg) } : null;
  const r = await syncBanditsFromYingchuanMergedDisk(opts);
  console.log(JSON.stringify(r, null, 2));
  if (!r.ok && r.reason === 'NO_MERGED_FILE') process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
