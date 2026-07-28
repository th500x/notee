#!/usr/bin/env node
/**
 * 05-san-storm 本地自动化检查（无 Jest / 无 Playwright 依赖）
 *
 * 默认：后端 *.js 语法扫描、共享 mapGenerator 自测、game 生产构建。
 * 可选：已启动后端时拉取 /api/health。
 *
 * 用法（仓库内请在 `05-san-storm` 目录执行，或任意 cwd 直接 node 本文件）：
 *   node scripts/run-automated-checks.cjs
 *   node scripts/run-automated-checks.cjs --quick
 *   node scripts/run-automated-checks.cjs --backend-url=http://127.0.0.1:3005
 *
 * 标志：
 *   --quick          跳过 `game` 的 `npm run build`（省时间）
 *   --no-backend     不请求健康检查（即使传了 --backend-url）
 *   --backend-url=   覆盖默认 http://127.0.0.1:3005
 */

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const flags = { quick: false, noBackend: false, backendUrl: 'http://127.0.0.1:3005' };
  for (const a of argv.slice(2)) {
    if (a === '--quick') flags.quick = true;
    else if (a === '--no-backend') flags.noBackend = true;
    else if (a.startsWith('--backend-url=')) flags.backendUrl = a.slice('--backend-url='.length).trim() || flags.backendUrl;
  }
  return flags;
}

function walkJsFiles(dir, out, depth = 0) {
  if (depth > 20) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const name = ent.name;
    if (name === 'node_modules' || name === '.git') continue;
    const full = path.join(dir, name);
    if (ent.isDirectory()) walkJsFiles(full, out, depth + 1);
    else if (name.endsWith('.js')) out.push(full);
  }
}

function phaseSyntaxBackend() {
  const backendRoot = path.join(ROOT, 'backend');
  if (!fs.existsSync(backendRoot)) {
    console.warn('[skip] backend 目录不存在');
    return { ok: true, skipped: true };
  }
  const files = [];
  walkJsFiles(backendRoot, files);
  const failures = [];
  for (const f of files) {
    const r = spawnSync(process.execPath, ['--check', f], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (r.status !== 0) failures.push({ file: f, stderr: r.stderr || '' });
  }
  if (failures.length) {
    console.error(`[fail] 后端语法检查: ${failures.length}/${files.length} 个文件未通过 node --check`);
    for (const { file, stderr } of failures.slice(0, 12)) {
      console.error('  -', path.relative(ROOT, file), stderr ? `\n${stderr}` : '');
    }
    if (failures.length > 12) console.error(`  … 另有 ${failures.length - 12} 个`);
    return { ok: false };
  }
  console.log(`[ok] 后端语法检查: ${files.length} 个 .js`);
  return { ok: true };
}

function phaseMapGenerator() {
  const scripts = [
    path.join(ROOT, 'shared', 'utils', 'mapGenerator_v2.test.cjs'),
    path.join(ROOT, 'shared', 'utils', 'pvpDuelMapGenerator.test.cjs'),
    path.join(ROOT, 'shared', 'utils', 'tacticalDeploySnap.test.cjs'),
    path.join(ROOT, 'backend', 'services', 'playerExploreEventService.dailyReset.test.cjs'),
    path.join(ROOT, 'shared', 'utils', 'eventOptionRewards.test.cjs'),
  ];
  for (const script of scripts) {
    const label = path.relative(ROOT, script);
    if (!fs.existsSync(script)) {
      console.warn(`[skip] ${label} 不存在`);
      continue;
    }
    const r = spawnSync(process.execPath, [script], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.status !== 0) {
      console.error(`[fail] ${label} 退出码`, r.status);
      return { ok: false };
    }
    console.log(`[ok] ${label}`);
  }
  return { ok: true };
}

function phaseGameBuild(quick) {
  if (quick) {
    console.log('[skip] game build（--quick）');
    return { ok: true, skipped: true };
  }
  const gameDir = path.join(ROOT, 'game');
  if (!fs.existsSync(path.join(gameDir, 'package.json'))) {
    console.warn('[skip] game/package.json 不存在');
    return { ok: true, skipped: true };
  }
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npmCmd, ['run', 'build'], {
    cwd: gameDir,
    encoding: 'utf8',
    stdio: 'inherit',
    env: { ...process.env, CI: '1' },
    windowsHide: true,
    /** Node ≥18.20 起 Windows 不允许直接 spawn `.cmd`（否则 status=null / EINVAL） */
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    console.error('[fail] game npm run build 退出码', r.status, r.error?.message || '');
    return { ok: false };
  }
  console.log('[ok] game npm run build');
  return { ok: true };
}

async function phaseBackendHealth(backendUrl, enabled) {
  if (!enabled) {
    console.log('[skip] 后端健康检查（--no-backend）');
    return { ok: true, skipped: true };
  }
  const url = `${String(backendUrl).replace(/\/$/, '')}/api/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      console.error('[fail] GET', url, 'HTTP', res.status, text.slice(0, 200));
      return { ok: false };
    }
    console.log('[ok] GET', url, json ? JSON.stringify(json) : text.slice(0, 120));
    return { ok: true };
  } catch (e) {
    console.warn('[warn] 健康检查未连上（后端未启动或端口不对）:', e.message || e);
    console.warn('      仅提示，不记为失败。需要硬失败时可改为 CI 环境变量约定。');
    return { ok: true, warn: true };
  }
}

(async () => {
  const flags = parseArgs(process.argv);
  const doHealth = !flags.noBackend;

  console.log('══════════════════════════════════════════════════════');
  console.log('  05-san-storm run-automated-checks');
  console.log('  ROOT:', ROOT);
  console.log('  flags:', JSON.stringify(flags));
  console.log('══════════════════════════════════════════════════════\n');

  const results = [];
  results.push(phaseSyntaxBackend());
  results.push(phaseMapGenerator());
  results.push(await phaseBackendHealth(flags.backendUrl, doHealth));
  results.push(phaseGameBuild(flags.quick));

  const hardFailed = results.some((r) => r && r.ok === false);
  if (hardFailed) {
    console.error('\n[exit] 存在失败项，退出码 1');
    process.exit(1);
  }
  console.log('\n[exit] 全部通过（健康检查连不上时仅 warn，仍算通过）');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
