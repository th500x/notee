/**
 * 将 wiki/public 下误变成「纯文本路径」的 data/assets/fonts/maps 恢复为指向
 * 05-san-storm/public 的目录联接（Windows junction）。Git 克隆在 Linux 且 core.symlinks=false
 * 时也会得到文本文件，需在 Windows 开发机本脚本修复一次。
 *
 * 用法（在 05-san-storm/wiki 目录）：node scripts/repair-public-junctions.mjs
 *
 * Wiki 开发/构建仍以 vite publicDir = ../public 为准；本联接仅供工具链读 wiki/public/* 路径。
 */

import { existsSync, lstatSync, readFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wikiPublic = resolve(__dirname, '../public');
const mainPublic = resolve(__dirname, '../../public');
const LINKS = ['data', 'assets', 'fonts', 'maps'];

function isPlainTextStub(filePath) {
  try {
    const st = lstatSync(filePath);
    if (!st.isFile()) return false;
    const text = readFileSync(filePath, 'utf8').trim();
    return text.startsWith('../') || text.startsWith('..\\');
  } catch {
    return false;
  }
}

for (const name of LINKS) {
  const linkPath = resolve(wikiPublic, name);
  const targetPath = resolve(mainPublic, name);
  if (!existsSync(targetPath)) {
    console.warn(`[repair-public-junctions] skip ${name}: target missing ${targetPath}`);
    continue;
  }
  if (existsSync(linkPath)) {
    if (isPlainTextStub(linkPath)) {
      rmSync(linkPath, { force: true });
      console.log(`[repair-public-junctions] removed text stub: ${name}`);
    } else {
      try {
        const st = lstatSync(linkPath);
        if (st.isDirectory()) {
          console.log(`[repair-public-junctions] ok (already dir): ${name}`);
          continue;
        }
      } catch {
        /* fall through */
      }
      rmSync(linkPath, { force: true, recursive: true });
    }
  }
  if (!existsSync(linkPath)) {
    execSync(`cmd /c mklink /J "${linkPath}" "${targetPath}"`, { stdio: 'inherit' });
    console.log(`[repair-public-junctions] junction: ${name} -> ${targetPath}`);
  }
}

console.log('[repair-public-junctions] done');
