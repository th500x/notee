/**
 * 账目单前端状态：双月窗口、租金行、固定支出类目、月度盈余（以 SETTLE 汇总为收入口径）。
 */

import { evaluateArithmeticExpression } from './accountingExpression';
import { sanitizeIsoDateField } from './accountingDates';

export const ACCOUNTING_EXPENSE_CATEGORY_KEYS = [
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

/** @returns {[string, string]} YYYY-MM：上月、本月（自然月，基于 date） */
export function defaultMonthKeysFromDate(d) {
  const dt = d instanceof Date ? d : new Date();
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const newer = `${y}-${pad2(m)}`;
  const prev = new Date(y, m - 2, 1);
  const older = `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}`;
  return [older, newer];
}

/** 表头展示：2026/4/1 */
export function monthKeyToHeaderLabel(monthKey) {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return monthKey;
  return `${m[1]}/${Number(m[2])}/1`;
}

export function emptyRentMonthCells() {
  return { in: '', out: '', settle: '', payRent: '' };
}

/** SETTLE = IN − OUT（算术格按数值参与；非数为 0） */
export function computeSettleFromInOut(cell) {
  if (!cell || typeof cell !== 'object') return NaN;
  const a = evaluateArithmeticExpression(cell.in);
  const b = evaluateArithmeticExpression(cell.out);
  const inVal = Number.isFinite(a) ? a : 0;
  const outVal = Number.isFinite(b) ? b : 0;
  return inVal - outVal;
}

export function buildDefaultExpenseRows(monthKeys) {
  const [m0, m1] = monthKeys;
  return ACCOUNTING_EXPENSE_CATEGORY_KEYS.map((categoryKey) => ({
    categoryKey,
    months: {
      [m0]: { out: '' },
      [m1]: { out: '' }
    }
  }));
}

export function defaultAccountingSheet() {
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

export function normalizeAccountingSheet(raw) {
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
            typeof row.id === 'string' && row.id
              ? row.id
              : `acc-r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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
          months
        };
      })
    : [];

  const expenseRows = [];
  const existing = Array.isArray(raw.expenseRows) ? raw.expenseRows : [];
  const byKey = Object.fromEntries(
    existing.map((r) => [r.categoryKey, r]).filter(([k]) => ACCOUNTING_EXPENSE_CATEGORY_KEYS.includes(k))
  );
  for (const categoryKey of ACCOUNTING_EXPENSE_CATEGORY_KEYS) {
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

function sumSettleForMonth(sheet, monthKey) {
  let total = 0;
  for (const row of sheet.rentRows) {
    const cell = row.months && row.months[monthKey];
    if (!cell) continue;
    const v = computeSettleFromInOut(cell);
    if (Number.isFinite(v)) total += v;
  }
  return total;
}

function sumExpenseOutForMonth(sheet, monthKey) {
  let total = 0;
  for (const row of sheet.expenseRows) {
    const cell = row.months && row.months[monthKey];
    if (!cell) continue;
    const v = evaluateArithmeticExpression(cell.out);
    if (Number.isFinite(v)) total += v;
  }
  return total;
}

/** 根据当前租金表 + 支出表计算两个月盈余，写入 monthlySummary（其它月份如历史导入保留） */
export function withComputedMonthlySummary(sheet) {
  const [m0, m1] = sheet.monthKeys;
  const next = { ...sheet.monthlySummary };
  for (const mk of [m0, m1]) {
    const income = sumSettleForMonth(sheet, mk);
    const expense = sumExpenseOutForMonth(sheet, mk);
    next[mk] = { income, expense, balance: income - expense };
  }
  return { ...sheet, monthlySummary: next };
}

/** 将某月在当前明细表上的 SETTLE 合计与支出合计写入一条 summary（供滚月后保留历史行） */
function freezeMonthSummaryFromSheet(sheet, monthKey) {
  const income = sumSettleForMonth(sheet, monthKey);
  const expense = sumExpenseOutForMonth(sheet, monthKey);
  return { income, expense, balance: income - expense };
}

/**
 * 按「今天」自然月对齐双月窗口：与当前窗口一致则不变；
 * 否则若旧右月 = 新左月则左移数据；否则保留固定列、清空月份格后套新窗口。
 */
export function rolloverAccountingWindowFromToday(sheet) {
  const target = defaultMonthKeysFromDate(new Date());
  const [o0, o1] = sheet.monthKeys;
  const [n0, n1] = target;
  if (o0 === n0 && o1 === n1) {
    return sheet;
  }

  const slide = o1 === n0;

  /** 滚月前：把即将从表中消失的月份的最终合计写入 monthlySummary，避免「收支账目」丢历史月 */
  const monthlySummary = { ...sheet.monthlySummary };
  if (slide) {
    monthlySummary[o0] = freezeMonthSummaryFromSheet(sheet, o0);
    delete monthlySummary[o1];
  } else {
    monthlySummary[o0] = freezeMonthSummaryFromSheet(sheet, o0);
    monthlySummary[o1] = freezeMonthSummaryFromSheet(sheet, o1);
  }

  const emptyRent = () => ({ [n0]: emptyRentMonthCells(), [n1]: emptyRentMonthCells() });

  let rentRows;
  let expenseRows;

  if (slide) {
    rentRows = sheet.rentRows.map((r) => {
      const months = r.months || {};
      return {
        ...r,
        months: {
          [n0]: months[o1] ? { ...emptyRentMonthCells(), ...months[o1] } : emptyRentMonthCells(),
          [n1]: emptyRentMonthCells()
        }
      };
    });
    expenseRows = sheet.expenseRows.map((r) => {
      const months = r.months || {};
      const outOld = months[o1] && typeof months[o1].out === 'string' ? months[o1].out : '';
      return {
        ...r,
        months: {
          [n0]: { out: outOld },
          [n1]: { out: '' }
        }
      };
    });
  } else {
    rentRows = sheet.rentRows.map((r) => ({
      ...r,
      months: emptyRent()
    }));
    expenseRows = buildDefaultExpenseRows(target);
  }

  return {
    ...sheet,
    monthKeys: target,
    rentRows,
    expenseRows,
    monthlySummary
  };
}

export function newRentRowId() {
  return `acc-r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyRentRow(monthKeys) {
  const [m0, m1] = monthKeys;
  return {
    id: newRentRowId(),
    room: '',
    declaration: '',
    actualRent: '',
    agency: '',
    remarks: '',
    price: '',
    deposit: '',
    months: {
      [m0]: emptyRentMonthCells(),
      [m1]: emptyRentMonthCells()
    }
  };
}
