import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const sourceDir = resolve(projectRoot, 'public', 'data', 'shared');
const targetDir = resolve(projectRoot, 'dist', 'data', 'shared');

if (!existsSync(sourceDir)) {
  console.warn(`[copy-shared-data] source missing: ${sourceDir}`);
  process.exit(0);
}

mkdirSync(resolve(projectRoot, 'dist', 'data'), { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true, force: true });
console.log(`[copy-shared-data] copied ${sourceDir} -> ${targetDir}`);
