/**
 * 服务端生成郡 32×40 合并地图 JSON（与 shared/utils/junCountyMapGenerator 同源算法）。
 * 用法（cwd = backend）:
 *   node scripts/worldmap-merge-yingchuan.mjs --out ../public/data/worldmap/{jun_id}_merged.json [--jun-id san_1_jun_yingchuan] [--seed 123]
 *
 * 道路层：若输出路径已存在且 JSON 内含非空 `roadCells`，写入前会**原样保留**到新生成的文件中，
 * 与 `worldMapAdminService.generateJunMergedMap` 行为一致，避免命令行重跑合并时冲掉管理员已保存的道路。
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname as pathDirname, resolve } from 'path';
import { createRequire } from 'module';

const __dirname = pathDirname(fileURLToPath(import.meta.url));

const SHARED_WM = resolve(__dirname, '../../shared/data/worldmap');

function loadPresetsByQuad(junId) {
  const jid = String(junId || '').trim();
  const out = {};
  for (const q of ['A', 'B', 'C', 'D']) {
    const fp = resolve(SHARED_WM, `${jid}_quad_${q}.preset.json`);
    if (!existsSync(fp)) {
      throw new Error(`Missing preset: ${fp}`);
    }
    out[q] = JSON.parse(readFileSync(fp, 'utf8'));
  }
  return out;
}

function inferSeasonFromJunId(junId) {
  const m = String(junId || '').match(/^(san_\d+)/i);
  return m ? m[1] : 'san_1';
}

async function main() {
  const argv = process.argv.slice(2);
  let outPath = null;
  let seedArg = null;
  let junId = 'san_1_jun_yingchuan';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) {
      outPath = argv[i + 1];
      i++;
    } else if (argv[i] === '--seed' && argv[i + 1]) {
      seedArg = argv[i + 1];
      i++;
    } else if (argv[i] === '--jun-id' && argv[i + 1]) {
      junId = argv[i + 1].trim();
      i++;
    }
  }
  if (!outPath) {
    console.error(
      'Usage: node scripts/worldmap-merge-yingchuan.mjs --out <path> [--jun-id <jun_id>] [--seed N]',
    );
    process.exit(1);
  }

  const presetsByQuad = loadPresetsByQuad(junId);
  const sharedGen = resolve(__dirname, '../../shared/utils/junCountyMapGenerator.js');
  const mod = await import(pathToFileURL(sharedGen).href);
  const gen = mod.generateJunCountyMergedSimulated;
  const opts = { junId, presetsByQuad };
  if (seedArg != null && seedArg !== '') opts.seed = Number(seedArg);
  const result = gen(opts);
  const version = Date.now();
  const payload = {
    version,
    junId,
    season: inferSeasonFromJunId(junId),
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
  const bandPath = resolve(__dirname, '../../shared/utils/strategicBanditPlaceholderPhase1.js');
  const { ensureJunMergedMapCells } = await import(pathToFileURL(bandPath).href);
  payload.cells = ensureJunMergedMapCells(payload.cells, result.seed, junId, {
    roadCells: Array.isArray(payload.roadCells) ? payload.roadCells : null,
    mapColumns: payload.mapColumns,
    mapRows: payload.mapRows,
  });
  mkdirSync(pathDirname(absOut), { recursive: true });
  writeFileSync(absOut, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`OK wrote ${absOut} version=${version} junId=${junId}`);

  if (junId === 'san_1_jun_yingchuan' || junId === 'san_1_jun_runan') {
    try {
      const require = createRequire(import.meta.url);
      require('dotenv').config({ path: resolve(__dirname, '../.env') });
      const { syncBanditsFromMergedDisk } = require('../services/banditInstanceService.js');
      const sync = await syncBanditsFromMergedDisk({ mergedAbsPath: absOut });
      console.log('[bandits]', JSON.stringify(sync));
    } catch (e) {
      console.warn('[bandits] sync skipped:', e?.message || e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
