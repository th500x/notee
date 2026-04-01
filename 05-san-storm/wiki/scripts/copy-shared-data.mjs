import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
/** 与游戏、CSV 导出共用：05-san-storm/public/data/shared（勿再维护 wiki/public 副本） */
const sourceDirMain = resolve(projectRoot, '..', 'public', 'data', 'shared');
const sourceDirWiki = resolve(projectRoot, 'public', 'data', 'shared');
const sourceDir = existsSync(sourceDirMain) ? sourceDirMain : sourceDirWiki;
const targetDir = resolve(projectRoot, 'dist', 'data', 'shared');

if (!existsSync(sourceDir)) {
  console.warn(`[copy-shared-data] source missing (tried main repo + wiki/public): ${sourceDirMain}`);
  process.exit(0);
}

mkdirSync(resolve(projectRoot, 'dist', 'data'), { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true, force: true });
console.log(`[copy-shared-data] copied ${sourceDir} -> ${targetDir}`);
