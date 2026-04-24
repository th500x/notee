/**
 * 一次性修补：汝南合并图曾误用颍川匪寨 `banditPoiId`（`san_1_bandit_*_yingchuan`），
 * 导致行军 `collectStrategicPoiFootprint` 与 `bandits` 实例语义错位。
 * 用法（cwd = 05-san-storm/backend）：node scripts/patch-san1-runan-merged-bandit-ids.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
const targets = [
  resolve(root, 'public/data/worldmap/san_1_jun_runan_merged.json'),
  resolve(root, 'game/dist/data/worldmap/san_1_jun_runan_merged.json'),
];

for (const fp of targets) {
  if (!existsSync(fp)) {
    console.warn('skip (missing):', fp);
    continue;
  }
  let s = readFileSync(fp, 'utf8');
  const before = s;
  s = s.split('san_1_bandit_1_yingchuan').join('san_1_bandit_1_runan');
  s = s.split('san_1_bandit_2_yingchuan').join('san_1_bandit_2_runan');
  s = s.split('颍川匪寨（一）').join('汝南匪寨（一）');
  s = s.split('颍川匪寨（二）').join('汝南匪寨（二）');
  if (s === before) {
    console.log('no changes:', fp);
    continue;
  }
  writeFileSync(fp, s, 'utf8');
  console.log('patched:', fp);
}
