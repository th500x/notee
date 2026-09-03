/**
 * 低配 VPS 专用生产构建：限制 Node 堆与 Rollup 并行，避免 rendering chunks 阶段占满内存导致整机死机。
 *
 * 用法：
 *   npm run build:vps
 *   VPS_BUILD_HEAP_MB=768 VPS_BUILD_PARALLEL=1 npm run build:vps
 *
 * 若仍 OOM：先 `pm2 stop` 后端 → 加 swap → 或本地 build 后 rsync dist/
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { printVpsBuildPreflight, resolveVpsHeapMb } from './vps-build-env.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = path.join(root, '..');

function findHtml2CanvasPackage(startDir) {
  let dir = startDir;
  for (let depth = 0; depth < 5; depth += 1) {
    const pkgJson = path.join(dir, 'node_modules', 'html2canvas', 'package.json');
    if (existsSync(pkgJson)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function ensureWorkspaceDepsForBuild() {
  if (findHtml2CanvasPackage(root)) return;
  console.error('[build:vps] 未找到 html2canvas；在 workspace 根目录执行 npm install…');
  const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (install.status !== 0) {
    throw new Error('[build:vps] npm install 失败；请手动在 33-san-storm 根目录执行 npm install 后重试');
  }
  if (!findHtml2CanvasPackage(root)) {
    throw new Error('[build:vps] 仍缺少 html2canvas；请在 33-san-storm 根目录执行 npm install');
  }
}

function findViteBin(startDir) {
  let dir = startDir;
  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = path.join(dir, 'node_modules', 'vite', 'bin', 'vite.js');
    if (existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error('[build:vps] 未找到 vite；请在 33-san-storm 根目录执行 npm install');
}

const viteBin = findViteBin(root);

const heapOverride = Number(process.env.VPS_BUILD_HEAP_MB);
const HEAP_MB = resolveVpsHeapMb(Number.isFinite(heapOverride) && heapOverride > 0 ? heapOverride : null);

const parallelRaw = Number(process.env.VPS_BUILD_PARALLEL);
const PARALLEL = Number.isFinite(parallelRaw) && parallelRaw >= 1 ? Math.min(4, Math.floor(parallelRaw)) : 1;

printVpsBuildPreflight({ heapMb: HEAP_MB, parallel: PARALLEL });
ensureWorkspaceDepsForBuild();

const startedAt = Date.now();
const heartbeatSec = Number(process.env.VPS_BUILD_HEARTBEAT_SEC) > 0
  ? Number(process.env.VPS_BUILD_HEARTBEAT_SEC)
  : 20;

const heartbeat = setInterval(() => {
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const rss = Math.round(process.memoryUsage().rss / 1024 / 1024);
  console.error(`[build:vps] 仍在构建… 已 ${elapsed}s（本进程 RSS ${rss}MB，rendering chunks 阶段较慢属正常）`);
}, heartbeatSec * 1000);

const child = spawn(
  process.execPath,
  [`--max-old-space-size=${HEAP_MB}`, viteBin, 'build', '--logLevel', 'info'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_LOW_MEM_BUILD: '1',
      VPS_BUILD_PARALLEL: String(PARALLEL),
      UV_THREADPOOL_SIZE: '1',
      NODE_OPTIONS: mergeNodeOptions(process.env.NODE_OPTIONS, `--max-old-space-size=${HEAP_MB}`),
    },
  },
);

function mergeNodeOptions(existing, extra) {
  const parts = String(existing || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !p.startsWith('--max-old-space-size='));
  parts.push(extra);
  return parts.join(' ');
}

child.on('exit', (code, signal) => {
  clearInterval(heartbeat);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (signal) {
    console.error(`[build:vps] 进程被信号终止: ${signal}（${elapsed}s，多为 OOM；可减小并发或加 swap）`);
    process.exit(1);
  }
  if (code === 0) {
    console.log(`[build:vps] 完成，耗时 ${elapsed}s`);
  } else {
    console.error(`[build:vps] 失败 exit=${code}，耗时 ${elapsed}s`);
  }
  process.exit(code ?? 1);
});
