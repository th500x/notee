/**
 * 服务端生成颍川郡 32×40 合并地图 JSON（与 shared/utils/junCountyMapGenerator 同源算法）。
 * 用法（cwd = backend）:
 *   node scripts/worldmap-merge-yingchuan.mjs --out ../public/data/worldmap/san_1_jun_yingchuan_merged.json [--seed 123]
 */
import { mkdirSync, writeFileSync } from 'fs';
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
  mkdirSync(pathDirname(absOut), { recursive: true });
  writeFileSync(absOut, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`OK wrote ${absOut} version=${version}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
