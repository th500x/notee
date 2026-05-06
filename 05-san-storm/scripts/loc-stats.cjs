#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = ['backend', 'game/src', 'wiki/src', 'shared'];
const EXTS = new Set(['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx']);
const SKIP_DIR = new Set(['node_modules', 'dist', '.git']);

function walk(dir, list) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP_DIR.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, list);
    else if (EXTS.has(path.extname(e.name))) {
      try {
        const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/).length;
        list.push({ loc: lines, path: path.relative(ROOT, full).replace(/\\/g, '/') });
      } catch {}
    }
  }
}

const summary = {};
const all = [];
for (const t of TARGETS) {
  const list = [];
  walk(path.join(ROOT, t), list);
  summary[t] = { files: list.length, loc: list.reduce((s, x) => s + x.loc, 0) };
  all.push(...list);
}

console.log('=== Summary ===');
for (const k of Object.keys(summary)) {
  console.log(k, summary[k]);
}
console.log('\n=== Top 30 by LOC (all) ===');
all.sort((a, b) => b.loc - a.loc).slice(0, 30).forEach(x => console.log(String(x.loc).padStart(6), x.path));

console.log('\n=== Top 20 by LOC (game/src only) ===');
all.filter(x => x.path.startsWith('game/src')).sort((a, b) => b.loc - a.loc).slice(0, 20).forEach(x => console.log(String(x.loc).padStart(6), x.path));

console.log('\n=== Top 20 by LOC (backend only) ===');
all.filter(x => x.path.startsWith('backend')).sort((a, b) => b.loc - a.loc).slice(0, 20).forEach(x => console.log(String(x.loc).padStart(6), x.path));
