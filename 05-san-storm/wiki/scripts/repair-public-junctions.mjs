/**
 * 将 wiki/public 下误变成「纯文本路径」的 data/assets/fonts/maps 恢复为指向
 * 05-san-storm/public 的目录联接（Windows junction）。Git 克隆在 Linux 且 core.symlinks=false
 * 时也会得到文本文件，需在 Windows 开发机本脚本修复一次。
 *
 * 亦会检测「联接仍在但目标路径失效」的情况（例如 Google Drive → Google Docs 迁移后
 * junction 仍指向旧盘符路径），自动拆除并重建。
 *
 * 用法（在 05-san-storm/wiki 目录）：node scripts/repair-public-junctions.mjs
 *
 * Wiki 开发/构建仍以 vite publicDir = ../public 为准；本联接仅供工具链读 wiki/public/* 路径。
 */

import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wikiPublic = resolve(__dirname, '../public');
const mainPublic = resolve(__dirname, '../../public');
const LINKS = ['data', 'assets', 'fonts', 'maps'];

function pathsEqual(a, b) {
  const left = resolve(a);
  const right = resolve(b);
  if (process.platform === 'win32') {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

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

/** 联接是否可解析且与期望的 public 子目录为同一路径 */
function junctionResolvesTo(linkPath, targetPath) {
  if (!existsSync(linkPath)) return false;
  try {
    const resolvedLink = realpathSync.native(linkPath);
    const resolvedTarget = realpathSync.native(resolve(targetPath));
    return pathsEqual(resolvedLink, resolvedTarget);
  } catch {
    return false;
  }
}

function getDeclaredTarget(linkPath) {
  try {
    return resolve(readlinkSync(linkPath));
  } catch {
    return null;
  }
}

/** 仅删除联接节点本身，不递归进入目标目录 */
function removeLinkEntry(linkPath) {
  if (!existsSync(linkPath)) return;
  const st = lstatSync(linkPath);
  if (st.isFile()) {
    rmSync(linkPath, { force: true });
    return;
  }
  if (process.platform === 'win32') {
    execSync(`cmd /c rmdir "${linkPath}"`, { stdio: 'inherit' });
  } else {
    rmSync(linkPath, { force: true });
  }
}

function needsRepair(linkPath, targetPath) {
  if (!existsSync(linkPath)) return true;
  if (isPlainTextStub(linkPath)) return true;

  const st = lstatSync(linkPath);
  if (st.isFile()) return true;

  const expected = resolve(targetPath);
  if (junctionResolvesTo(linkPath, expected)) return false;

  const declared = getDeclaredTarget(linkPath);
  if (declared && !pathsEqual(declared, expected)) {
    console.log(
      `[repair-public-junctions] stale target: ${linkPath} -> ${declared} (want ${expected})`,
    );
  } else {
    console.log(`[repair-public-junctions] broken or mismatched: ${linkPath}`);
  }
  return true;
}

for (const name of LINKS) {
  const linkPath = resolve(wikiPublic, name);
  const targetPath = resolve(mainPublic, name);
  if (!existsSync(targetPath)) {
    console.warn(`[repair-public-junctions] skip ${name}: target missing ${targetPath}`);
    continue;
  }

  if (needsRepair(linkPath, targetPath)) {
    if (existsSync(linkPath)) {
      if (isPlainTextStub(linkPath)) {
        console.log(`[repair-public-junctions] removed text stub: ${name}`);
      } else {
        console.log(`[repair-public-junctions] removing stale entry: ${name}`);
      }
      removeLinkEntry(linkPath);
    }
  } else {
    console.log(`[repair-public-junctions] ok: ${name} -> ${targetPath}`);
    continue;
  }

  if (!existsSync(linkPath)) {
    execSync(`cmd /c mklink /J "${linkPath}" "${targetPath}"`, { stdio: 'inherit' });
    console.log(`[repair-public-junctions] junction: ${name} -> ${targetPath}`);
  }
}

console.log('[repair-public-junctions] done');
