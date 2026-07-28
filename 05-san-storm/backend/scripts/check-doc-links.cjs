/**
 * 临时：扫描 docs/ 下 Markdown 相对链接，并分类：
 *   FIXABLE  同名文件在 docs 内其它位置存在（多为目录迁移失修）
 *   RENAMED  同「文号前缀」的文件存在但文件名不同（如 31-6-*_PVP → *_MARCH）
 *   ORPHAN   docs 内找不到任何候选（文档已删/从未存在）
 *   OUTSIDE  指向 docs 之外（.cursor 等，非本轮目标）
 * 用法：node backend/scripts/_tmp_check_doc_links.cjs [--fix]
 */
const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.resolve(__dirname, '../../docs');
const APPLY_FIX = process.argv.includes('--fix');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const allFiles = walk(DOCS_ROOT);
const mdFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.md'));

/** basename(lower) -> [abs paths] */
const byBase = new Map();
for (const f of allFiles) {
  const key = path.basename(f).toLowerCase();
  if (!byBase.has(key)) byBase.set(key, []);
  byBase.get(key).push(f);
}

/** 文号前缀（如 31-6- / 13-1- / 70-1-）-> [abs md paths] */
const byNumber = new Map();
for (const f of mdFiles) {
  const m = path.basename(f).match(/^(\d+(?:-\d+)?)-/);
  if (!m) continue;
  const key = m[1];
  if (!byNumber.has(key)) byNumber.set(key, []);
  byNumber.get(key).push(f);
}

const LINK_RE = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const buckets = { FIXABLE: [], RENAMED: [], ORPHAN: [], OUTSIDE: [] };
const editsByFile = new Map();

for (const file of mdFiles) {
  const text = fs.readFileSync(file, 'utf8');
  text.split(/\r?\n/).forEach((line, idx) => {
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(line)) !== null) {
      const raw = m[2];
      if (/^(https?:|mailto:|#)/i.test(raw)) continue;
      const [pathPart, hash] = raw.split('#');
      const clean = decodeURIComponent(pathPart).trim();
      if (!clean) continue;
      const abs = path.resolve(path.dirname(file), clean);
      if (fs.existsSync(abs)) continue;

      const rel = path.relative(DOCS_ROOT, file).replace(/\\/g, '/');
      const rec = { file: rel, line: idx + 1, label: m[1], target: raw };

      if (!abs.startsWith(DOCS_ROOT)) {
        buckets.OUTSIDE.push(rec);
        continue;
      }

      const base = path.basename(clean).toLowerCase();
      const sameName = byBase.get(base) || [];
      if (sameName.length === 1) {
        const suggest = path
          .relative(path.dirname(file), sameName[0])
          .replace(/\\/g, '/');
        rec.suggest = (suggest.startsWith('.') ? suggest : `./${suggest}`) + (hash ? `#${hash}` : '');
        buckets.FIXABLE.push(rec);
        if (!editsByFile.has(file)) editsByFile.set(file, []);
        editsByFile.get(file).push({ from: raw, to: rec.suggest });
        continue;
      }
      if (sameName.length > 1) {
        rec.candidates = sameName.map((p) => path.relative(DOCS_ROOT, p).replace(/\\/g, '/'));
        buckets.ORPHAN.push(rec);
        continue;
      }

      const num = path.basename(clean).match(/^(\d+(?:-\d+)?)-/);
      const numCands = num ? byNumber.get(num[1]) || [] : [];
      if (numCands.length === 1) {
        const suggest = path
          .relative(path.dirname(file), numCands[0])
          .replace(/\\/g, '/');
        rec.suggest = (suggest.startsWith('.') ? suggest : `./${suggest}`) + (hash ? `#${hash}` : '');
        // RENAMED 仅为「同文号」猜测，可能张冠李戴（21-CHARACTER → 21-frontend-wiki），不进 --fix
        buckets.RENAMED.push(rec);
        continue;
      }
      if (numCands.length > 1) {
        rec.candidates = numCands.map((p) => path.relative(DOCS_ROOT, p).replace(/\\/g, '/'));
      }
      buckets.ORPHAN.push(rec);
    }
  });
}

const total = Object.values(buckets).reduce((s, b) => s + b.length, 0);
console.log(`md files: ${mdFiles.length} · broken links: ${total}`);
for (const [k, v] of Object.entries(buckets)) console.log(`  ${k}: ${v.length}`);

for (const kind of ['ORPHAN', 'RENAMED', 'OUTSIDE']) {
  console.log(`\n===== ${kind} =====`);
  for (const r of buckets[kind]) {
    const extra = r.suggest
      ? `  => ${r.suggest}`
      : r.candidates
        ? `  ?? ${r.candidates.join(' | ')}`
        : '';
    console.log(`${r.file}:${r.line}  ${r.target}${extra}`);
  }
}

console.log(`\n===== FIXABLE (${buckets.FIXABLE.length}) =====`);
if (process.argv.includes('--verbose')) {
  for (const r of buckets.FIXABLE) {
    console.log(`${r.file}:${r.line}  ${r.target}  => ${r.suggest}`);
  }
  console.log('');
}
const fixableByFile = new Map();
for (const r of buckets.FIXABLE) {
  if (!fixableByFile.has(r.file)) fixableByFile.set(r.file, 0);
  fixableByFile.set(r.file, fixableByFile.get(r.file) + 1);
}
for (const [f, n] of [...fixableByFile.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${n}\t${f}`);
}

if (APPLY_FIX) {
  let changedFiles = 0;
  let changedLinks = 0;
  for (const [file, edits] of editsByFile) {
    let text = fs.readFileSync(file, 'utf8');
    let touched = false;
    for (const { from, to } of edits) {
      const needle = `](${from})`;
      if (text.includes(needle)) {
        const before = text;
        text = text.split(needle).join(`](${to})`);
        if (text !== before) {
          touched = true;
          changedLinks += 1;
        }
      }
    }
    if (touched) {
      fs.writeFileSync(file, text, 'utf8');
      changedFiles += 1;
    }
  }
  console.log(`\nFIX applied: ${changedLinks} links in ${changedFiles} files`);
}
