import { useMemo } from 'react';
import { formatAccountingNumber, evaluateArithmeticExpression } from '../../utils/accountingExpression';
import { monthKeyToHeaderLabel, computeSettleFromInOut } from '../../utils/accountingSheetModel';

function sumSettleMonth(sheet, monthKey) {
  let s = 0;
  for (const row of sheet.rentRows) {
    const cell = row.months && row.months[monthKey];
    if (!cell) continue;
    const v = computeSettleFromInOut(cell);
    if (Number.isFinite(v)) s += v;
  }
  return s;
}

function sumExpenseMonth(sheet, monthKey) {
  let s = 0;
  for (const row of sheet.expenseRows) {
    const cell = row.months && row.months[monthKey];
    if (!cell) continue;
    const v = evaluateArithmeticExpression(cell.out);
    if (Number.isFinite(v)) s += v;
  }
  return s;
}

export function AccountingSummaryTab({ sheet }) {
  const [m0, m1] = sheet.monthKeys;

  const rows = useMemo(() => {
    const mkRe = /^\d{4}-\d{2}$/;
    const fromSummary = Object.keys(sheet.monthlySummary || {}).filter((k) => mkRe.test(k));
    const allMonths = [...new Set([...fromSummary, m0, m1])].sort((a, b) => a.localeCompare(b));

    return allMonths.map((mk) => {
      const isWindow = mk === m0 || mk === m1;
      if (isWindow) {
        const income = sumSettleMonth(sheet, mk);
        const expense = sumExpenseMonth(sheet, mk);
        return { mk, income, expense, balance: income - expense, mode: 'live' };
      }
      const s = sheet.monthlySummary[mk];
      const income = Number(s?.income);
      const expense = Number(s?.expense);
      let balance = Number(s?.balance);
      if (!Number.isFinite(balance) && Number.isFinite(income) && Number.isFinite(expense)) {
        balance = income - expense;
      }
      return {
        mk,
        income: Number.isFinite(income) ? income : NaN,
        expense: Number.isFinite(expense) ? expense : NaN,
        balance: Number.isFinite(balance) ? balance : NaN,
        mode: 'imported'
      };
    });
  }, [sheet, m0, m1]);

  return (
    <div className="bg-white rounded-lg shadow-md min-w-0 max-w-full w-full">
      <div className="w-full min-w-0 bg-gradient-to-r from-blue-500 to-purple-600 px-4 sm:px-6 py-4 text-white box-border">
        <h3 className="text-lg font-semibold">收支账目 · Summary</h3>
        <p className="text-xs text-blue-100 mt-1 leading-relaxed">
          当前双月窗口（{monthKeyToHeaderLabel(m0)} / {monthKeyToHeaderLabel(m1)}）按租金 SETTLE 与支出 OUT
          实时计算；其它月份可来自历史导入（仅影响本表，不改租金/支出明细）。
        </p>
      </div>
      <table className="w-full min-w-0 max-w-full table-fixed text-sm border-collapse">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[25%]" />
          <col className="w-[25%]" />
          <col className="w-[24%]" />
        </colgroup>
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="p-1.5 sm:p-2 text-left border border-gray-700 text-[11px] sm:text-sm font-medium leading-tight whitespace-normal">
              Month
            </th>
            <th className="p-1.5 sm:p-2 text-right border border-gray-700 text-[10px] sm:text-xs font-medium leading-tight whitespace-normal">
              Income (SETTLE Σ)
            </th>
            <th className="p-1.5 sm:p-2 text-right border border-gray-700 text-[10px] sm:text-xs font-medium leading-tight whitespace-normal">
              Expense (OUT Σ)
            </th>
            <th className="p-1.5 sm:p-2 text-right border border-gray-700 text-[10px] sm:text-xs font-medium leading-tight whitespace-normal">
              当前盈余
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.mk}
              className={`border-b border-gray-100 ${r.mode === 'imported' ? 'bg-amber-50/40' : ''}`}
            >
              <td className="p-1.5 sm:p-2 font-medium text-gray-900 border border-gray-100 text-[11px] sm:text-sm align-top break-words">
                {monthKeyToHeaderLabel(r.mk)}
                {r.mode === 'imported' ? (
                  <span className="ml-0.5 text-[9px] font-normal text-amber-800 whitespace-nowrap">
                    历史
                  </span>
                ) : null}
              </td>
              <td className="p-1.5 sm:p-2 text-right border border-gray-100 text-[11px] sm:text-sm tabular-nums">
                {formatAccountingNumber(r.income)}
              </td>
              <td className="p-1.5 sm:p-2 text-right border border-gray-100 text-[11px] sm:text-sm tabular-nums">
                {formatAccountingNumber(r.expense)}
              </td>
              <td
                className={`p-1.5 sm:p-2 text-right font-semibold border border-gray-100 text-[11px] sm:text-sm tabular-nums ${
                  !Number.isFinite(r.balance)
                    ? 'text-gray-500'
                    : r.balance >= 0
                      ? 'text-green-700'
                      : 'text-red-700'
                }`}
              >
                {formatAccountingNumber(r.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
