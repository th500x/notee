/**
 * 将子项目根目录 history.md（制表符分隔：日期 IN OUT）合并到指定账目项目的 accounting_sheet.monthlySummary。
 * 仅写入汇总 JSON，不修改 rentRows / expenseRows；收支账目页会按月份列出「历史」行。
 *
 * 用法（在 backend 目录）:
 *   node scripts/import-history-monthly-summary.js --project-id=<项目id>
 *   node scripts/import-history-monthly-summary.js --project-id=<id> --file="D:/path/history.md"
 *   node scripts/import-history-monthly-summary.js --project-id=<id> --dry-run
 *
 * 依赖: backend/.env（与 migrate 脚本相同）
 */

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const backendRoot = path.join(__dirname, '..');
const requireBackend = createRequire(path.join(backendRoot, 'package.json'));

requireBackend('dotenv').config({ path: path.join(backendRoot, '.env') });
requireBackend('dotenv').config({ path: path.join(backendRoot, '.env.local'), override: true });
const mysql = requireBackend('mysql2/promise');
const { normalizeAccountingSheet } = require('../utils/accountingSheet');

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { projectId: null, file: null, dryRun: false };
  for (const x of a) {
    if (x === '--dry-run') out.dryRun = true;
    else if (x.startsWith('--project-id=')) out.projectId = x.slice('--project-id='.length).trim();
    else if (x.startsWith('--file=')) out.file = x.slice('--file='.length).trim();
  }
  return out;
}

/** `2024/4/1` → `2024-04`（按日历校验该日） */
function dateSlashToMonthKey(s) {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(String(s).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${m[1]}-${String(mo).padStart(2, '0')}`;
}

function parseCommaNumber(s) {
  const t = String(s).replace(/,/g, '').trim();
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * @param {string} content
 * @returns {{ monthKey: string, income: number, expense: number, balance: number }[]}
 */
function parseHistoryMarkdown(content) {
  const rows = [];
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const normHeader = t.replace(/\s+/g, ' ').toUpperCase();
    if (normHeader === 'IN OUT' || normHeader.endsWith(' IN OUT')) continue;

    const parts = t.split(/\t/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 3) continue;

    const mk = dateSlashToMonthKey(parts[0]);
    if (!mk) continue;

    const income = parseCommaNumber(parts[1]);
    const expense = parseCommaNumber(parts[2]);
    if (!Number.isFinite(income) || !Number.isFinite(expense)) continue;

    rows.push({ monthKey: mk, income, expense, balance: income - expense });
  }
  return rows;
}

async function main() {
  const { projectId, file, dryRun } = parseArgs();
  if (!projectId) {
    console.error(
      '用法: node scripts/import-history-monthly-summary.js --project-id=<id> [--file=路径\\history.md] [--dry-run]'
    );
    process.exit(1);
  }

  const historyPath = file ? path.resolve(file) : path.join(backendRoot, '..', 'history.md');
  if (!fs.existsSync(historyPath)) {
    console.error('找不到文件:', historyPath);
    process.exit(1);
  }

  const text = fs.readFileSync(historyPath, 'utf8');
  const parsed = parseHistoryMarkdown(text);
  if (parsed.length === 0) {
    console.error('未能从文件中解析出任何月份行:', historyPath);
    process.exit(1);
  }
  console.log('已解析', parsed.length, '个月，来源:', historyPath);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '06_rental_tracking'
  });

  const [rows] = await conn.execute(
    'SELECT id, name, project_kind, accounting_sheet FROM projects WHERE id = ?',
    [projectId]
  );
  if (!rows || !rows[0]) {
    console.error('未找到项目:', projectId);
    await conn.end();
    process.exit(1);
  }
  const row = rows[0];
  if ((row.project_kind || 'rental') !== 'accounting') {
    console.error('项目不是账目类型 (project_kind):', row.project_kind);
    await conn.end();
    process.exit(1);
  }

  let sheet;
  try {
    sheet =
      typeof row.accounting_sheet === 'string'
        ? JSON.parse(row.accounting_sheet)
        : row.accounting_sheet || {};
  } catch (e) {
    console.error('accounting_sheet JSON 解析失败:', e.message);
    await conn.end();
    process.exit(1);
  }

  const merged = { ...sheet };
  merged.monthlySummary = { ...(merged.monthlySummary || {}) };
  for (const r of parsed) {
    merged.monthlySummary[r.monthKey] = {
      income: r.income,
      expense: r.expense,
      balance: r.balance
    };
  }

  const normalized = normalizeAccountingSheet(merged);
  const jsonStr = JSON.stringify(normalized);
  const monthCount = Object.keys(normalized.monthlySummary || {}).length;

  if (dryRun) {
    console.log('[dry-run] 将写入 monthlySummary 月份键:', Object.keys(normalized.monthlySummary).sort().join(', '));
    console.log('[dry-run] JSON 长度', jsonStr.length);
    await conn.end();
    return;
  }

  await conn.execute('UPDATE projects SET accounting_sheet = ?, version = version + 1 WHERE id = ?', [
    jsonStr,
    projectId
  ]);
  console.log('OK: 已合并到项目', projectId, `(${row.name || ''})`, 'monthlySummary 月份数:', monthCount);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
