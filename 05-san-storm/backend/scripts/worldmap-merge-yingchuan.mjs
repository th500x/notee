/**
 * 服务端生成颍川郡 32×40 合并地图 JSON（与 shared/utils/junCountyMapGenerator 同源算法）。
 * 用法（cwd = backend）:
 *   node scripts/worldmap-merge-yingchuan.mjs --out ../public/data/worldmap/san_1_jun_yingchuan_merged.json [--seed 123]
 *
 * 道路层：若输出路径已存在且 JSON 内含非空 `roadCells`，写入前会**原样保留**到新生成的文件中，
 * 与 `worldMapAdminService.generateYingchuanMergedMap` 行为一致，避免命令行重跑合并时冲掉管理员已保存的道路。
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname as pathDirname, resolve } from 'path';

const __dirname = pathDirname(fileURLToPath(import.meta.url));

async function main() {
  const argv = process.argv.slice(2);
  let outPath = null;
  let seedArg = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) {
      outPath = argv[i + 1];
      i++;
    } else if (argv[i] === '--seed' && argv[i + 1]) {
      seedArg = argv[i + 1];
      i++;
    }
  }
  if (!outPath) {
    console.error('Usage: node scripts/worldmap-merge-yingchuan.mjs --out <path> [--seed N]');
    process.exit(1);
  }

  const sharedGen = resolve(__dirname, '../../shared/utils/junCountyMapGenerator.js');
  const mod = await import(pathToFileURL(sharedGen).href);
  const gen = mod.generateYingchuanCountyMergedSimulated;
  const opts = {};
  if (seedArg != null && seedArg !== '') opts.seed = Number(seedArg);
  const result = gen(opts);
  const version = Date.now();
  const payload = {
    version,
    junId: 'san_1_jun_yingchuan',
    season: 'san_1',
    generatedAt: new Date().toISOString(),
    seed: result.seed,
    mapColumns: result.mapColumns,
    mapRows: result.mapRows,
    campaignId: result.campaignId,
    cells: result.cells,
  };
  const absOut = resolve(process.cwd(), outPath);
  if (existsSync(absOut)) {
    try {
      const prev = JSON.parse(readFileSync(absOut, 'utf8'));
      if (prev && Array.isArray(prev.roadCells) && prev.roadCells.length > 0) {
        const overlayPath = resolve(__dirname, '../../shared/utils/strategicRoadOverlay.js');
        const roadMod = await import(pathToFileURL(overlayPath).href);
        const normalize = roadMod.normalizeRoadCellList;
        const conn4 = roadMod.ROAD_CONNECTIVITY_4;
        payload.roadCells = normalize(prev.roadCells);
        payload.roadConnectivity = prev.roadConnectivity === '8' ? '8' : conn4;
      }
    } catch {
      /* 旧文件损坏或不可解析时仅重写底板，不阻塞合并 */
    }
  }
  mkdirSync(pathDirname(absOut), { recursive: true });
  writeFileSync(absOut, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`OK wrote ${absOut} version=${version}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
