/**
 * 账目单 JSON：服务端默认值与归一化（与前端 accountingSheetModel 结构一致）
 */

const crypto = require('crypto');
const { evaluateArithmeticExpression } = require('./accountingExpression');
const { sanitizeIsoDateField } = require('./accountingDates');

const EXPENSE_CATEGORY_KEYS = [
  'FAMILY',
  'TRAFFIC',
  'SHOPPING',
  'ENTERTM',
  'EATING',
  'HEALTH',
  'DRINKING'
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** @returns {[string, string]} YYYY-MM 上月、本月（按「今天」自然月） */
function defaultMonthKeysFromDate(d) {
  const dt = d instanceof Date ? d : new Date();
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const newer = `${y}-${pad2(m)}`;
  const prev = new Date(y, m - 2, 1);
  const older = `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}`;
  return [older, newer];
}

function emptyRentMonthCells() {
  return { in: '', out: '', settle: '', payRent: '' };
}

function buildDefaultExpenseRows(monthKeys) {
  const [m0, m1] = monthKeys;
  return EXPENSE_CATEGORY_KEYS.map((categoryKey) => ({
    categoryKey,
    months: {
      [m0]: { out: '' },
      [m1]: { out: '' }
    }
  }));
}

function defaultAccountingSheet() {
  const monthKeys = defaultMonthKeysFromDate(new Date());
  return {
    monthKeys,
    rentRows: [],
    expenseRows: buildDefaultExpenseRows(monthKeys),
    monthlySummary: {}
  };
}

function normalizeMonthKeys(rawKeys, fallbackDate) {
  if (!Array.isArray(rawKeys) || rawKeys.length !== 2) {
    return defaultMonthKeysFromDate(fallbackDate || new Date());
  }
  const re = /^\d{4}-\d{2}$/;
  if (!re.test(rawKeys[0]) || !re.test(rawKeys[1])) {
    return defaultMonthKeysFromDate(fallbackDate || new Date());
  }
  return [rawKeys[0], rawKeys[1]];
}

function computeSettleFromInOut(cell) {
  if (!cell || typeof cell !== 'object') return NaN;
  const a = evaluateArithmeticExpression(cell.in);
  const b = evaluateArithmeticExpression(cell.out);
  const inVal = Number.isFinite(a) ? a : 0;
  const outVal = Number.isFinite(b) ? b : 0;
  return inVal - outVal;
}

function normalizeGalleryPhoto(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 200) : '';
  const url = typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim().slice(0, 2000) : '';
  if (!id || !url) return null;
  return {
    id,
    url,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 255) : '',
    size: Number.isFinite(Number(raw.size)) ? Number(raw.size) : undefined,
    uploadedAt: typeof raw.uploadedAt === 'string' ? raw.uploadedAt.slice(0, 50) : '',
    capturedAt: typeof raw.capturedAt === 'string' ? raw.capturedAt.slice(0, 50) : ''
  };
}

function normalizeGalleryPhotos(rawPhotos) {
  if (!Array.isArray(rawPhotos)) return [];
  const out = [];
  for (const p of rawPhotos) {
    if (out.length >= 500) break;
    const n = normalizeGalleryPhoto(p);
    if (n) out.push(n);
  }
  return out;
}

function normalizeGalleryShareToken(raw) {
  if (typeof raw !== 'string') return '';
  const t = raw.trim().slice(0, 80);
  return /^[\w-]+$/.test(t) ? t : '';
}

function normalizeAccountingSheet(raw) {
  const base = defaultAccountingSheet();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const monthKeys = normalizeMonthKeys(raw.monthKeys, new Date());
  const [m0, m1] = monthKeys;

  const rentRows = Array.isArray(raw.rentRows)
    ? raw.rentRows.slice(0, 200).map((row) => {
        const months = {};
        for (const mk of [m0, m1]) {
          const cell = row.months && row.months[mk] ? row.months[mk] : {};
          const inStr = typeof cell.in === 'string' ? cell.in.slice(0, 500) : '';
          const outStr = typeof cell.out === 'string' ? cell.out.slice(0, 500) : '';
          const payRentStr = sanitizeIsoDateField(
            typeof cell.payRent === 'string' ? cell.payRent : ''
          );
          const settleNum = computeSettleFromInOut({ in: inStr, out: outStr });
          months[mk] = {
            in: inStr,
            out: outStr,
            settle: Number.isFinite(settleNum) ? String(settleNum) : '',
            payRent: payRentStr
          };
        }
        return {
          id:
            typeof row.id === 'string' && row.id.trim()
              ? row.id.trim()
              : `acc-r-${crypto.randomBytes(8).toString('hex')}`,
          room: typeof row.room === 'string' ? row.room.slice(0, 200) : '',
          declaration: sanitizeIsoDateField(
            typeof row.declaration === 'string' ? row.declaration : ''
          ),
          actualRent: sanitizeIsoDateField(
            typeof row.actualRent === 'string' ? row.actualRent : ''
          ),
          agency: typeof row.agency === 'string' ? row.agency.slice(0, 500) : '',
          remarks: typeof row.remarks === 'string' ? row.remarks.slice(0, 500) : '',
          price: typeof row.price === 'string' ? row.price.slice(0, 500) : '',
          deposit: typeof row.deposit === 'string' ? row.deposit.slice(0, 500) : '',
          months,
          photos: normalizeGalleryPhotos(row.photos),
          galleryShareToken: normalizeGalleryShareToken(row.galleryShareToken)
        };
      })
    : [];

  const expenseRows = [];
  const existing = Array.isArray(raw.expenseRows) ? raw.expenseRows : [];
  const byKey = Object.fromEntries(
    existing.map((r) => [r.categoryKey, r]).filter(([k]) => EXPENSE_CATEGORY_KEYS.includes(k))
  );
  for (const categoryKey of EXPENSE_CATEGORY_KEYS) {
    const row = byKey[categoryKey];
    const months = {};
    for (const mk of [m0, m1]) {
      const out =
        row && row.months && row.months[mk] && typeof row.months[mk].out === 'string'
          ? row.months[mk].out.slice(0, 500)
          : '';
      months[mk] = { out };
    }
    expenseRows.push({ categoryKey, months });
  }

  let rawMonthlySummary = raw.monthlySummary;
  if (typeof rawMonthlySummary === 'string') {
    try {
      rawMonthlySummary = JSON.parse(rawMonthlySummary);
    } catch {
      rawMonthlySummary = null;
    }
  }

  const monthlySummary = {};
  if (rawMonthlySummary && typeof rawMonthlySummary === 'object') {
    const mkRe = /^\d{4}-\d{2}$/;
    for (const mk of Object.keys(rawMonthlySummary)) {
      if (!mkRe.test(mk)) continue;
      const s = rawMonthlySummary[mk];
      if (!s || typeof s !== 'object') continue;
      const entry = {};
      const inc = Number(s.income);
      const exp = Number(s.expense);
      const bal = Number(s.balance);
      if (Number.isFinite(inc)) entry.income = inc;
      if (Number.isFinite(exp)) entry.expense = exp;
      if (Number.isFinite(bal)) entry.balance = bal;
      else if (Number.isFinite(inc) && Number.isFinite(exp)) entry.balance = inc - exp;
      if (Object.keys(entry).length === 0) continue;
      monthlySummary[mk] = entry;
    }
  }

  return { monthKeys, rentRows, expenseRows, monthlySummary };
}

module.exports = {
  defaultAccountingSheet,
  normalizeAccountingSheet,
  EXPENSE_CATEGORY_KEYS
};
