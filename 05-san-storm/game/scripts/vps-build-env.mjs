/**
 * 低配 VPS 构建环境探测与预检（供 build-vps.mjs 使用）。
 */
import { readFileSync } from 'node:fs';

/**
 * @returns {{ totalMb: number|null, availableMb: number|null }}
 */
export function readLinuxMemoryMb() {
  try {
    const raw = readFileSync('/proc/meminfo', 'utf8');
    const total = raw.match(/^MemTotal:\s+(\d+)\s+kB/m);
    const avail = raw.match(/^MemAvailable:\s+(\d+)\s+kB/m);
    return {
      totalMb: total ? Math.floor(Number(total[1]) / 1024) : null,
      availableMb: avail ? Math.floor(Number(avail[1]) / 1024) : null,
    };
  } catch {
    return { totalMb: null, availableMb: null };
  }
}

/**
 * 根据可用内存估算 Node 堆上限（避免 rendering chunks OOM，也避免堆过大挤爆系统）。
 * @param {number|null} overrideMb  VPS_BUILD_HEAP_MB
 */
export function resolveVpsHeapMb(overrideMb) {
  if (Number.isFinite(overrideMb) && overrideMb > 0) return Math.floor(overrideMb);

  const { totalMb, availableMb } = readLinuxMemoryMb();
  if (availableMb != null) {
    if (availableMb >= 1800) return 1280;
    if (availableMb >= 1200) return 1024;
    if (availableMb >= 700) return 768;
    if (availableMb >= 450) return 512;
    return 384;
  }
  if (totalMb != null && totalMb >= 3500) return 1536;
  return 1024;
}

/**
 * @param {{ heapMb: number, parallel: number }} cfg
 */
export function printVpsBuildPreflight(cfg) {
  const { totalMb, availableMb } = readLinuxMemoryMb();
  console.log('[build:vps] ── 预检 ──');
  if (totalMb != null) {
    console.log(`[build:vps] 内存：总计 ${totalMb}MB · 可用 ${availableMb ?? '?'}MB`);
  } else {
    console.log('[build:vps] 内存：非 Linux 或未读到 /proc/meminfo，使用默认堆上限');
  }
  console.log(`[build:vps] Node 堆上限：${cfg.heapMb}MB（可设 VPS_BUILD_HEAP_MB）`);
  console.log(`[build:vps] Rollup 并行文件：${cfg.parallel}（可设 VPS_BUILD_PARALLEL=1|2）`);
  console.log('[build:vps] rendering chunks 在 2GB VPS 上常需 3～15 分钟，并非卡死；下方每 20s 有心跳');
  if (availableMb != null && availableMb < 600) {
    console.warn(
      '[build:vps] ⚠ 可用内存偏低：建议先 pm2 stop 后端、关闭其它 build，或临时加 1GB swap 后再构建',
    );
  }
  console.log('[build:vps] ── 开始 vite build ──');
}
