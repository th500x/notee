/**
 * One-shot: upsert `bandits` rows for S1 豫州颍川 / 汝南阶段一匪寨（与坐标入库 / 合并图同步一致）。
 * Usage (cwd=backend): node scripts/ensure-phase1-bandits-db.js
 */
const path = require('path');
const banditInstanceService = require('../services/banditInstanceService');

async function main() {
  const publicRoot = path.join(__dirname, '../../public');
  for (const junId of ['san_1_jun_yingchuan', 'san_1_jun_runan']) {
    const p1 = await banditInstanceService.ensurePhase1BanditsForJunDb(junId);
    console.log('[phase1]', junId, p1);
    const mergedAbs = path.join(publicRoot, 'data/worldmap', `${junId}_merged.json`);
    const sync = await banditInstanceService.syncBanditsFromMergedDisk({ mergedAbsPath: mergedAbs });
    console.log('[sync]', junId, sync);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
