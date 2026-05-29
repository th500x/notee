/**
 * 低配 VPS 专用生产构建：限制 Node 堆与 Rollup 并行，避免 rendering chunks 阶段占满内存导致整机死机。
 * 用法：npm run build:vps
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

/** 堆上限：2GB 机器建议 1024；4GB 可改为 1536 */
const HEAP_MB = Number(process.env.VPS_BUILD_HEAP_MB) > 0
  ? Number(process.env.VPS_BUILD_HEAP_MB)
  : 1024;

const child = spawn(
  process.execPath,
  [`--max-old-space-size=${HEAP_MB}`, viteBin, 'build'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_LOW_MEM_BUILD: '1',
      UV_THREADPOOL_SIZE: '2',
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[build:vps] 进程被信号终止: ${signal}（多为内存不足 OOM）`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
