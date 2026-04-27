import { useMemo } from 'react';
import { AccountingFormulaCell } from './AccountingFormulaCell';
import { evaluateArithmeticExpression, formatAccountingNumber } from '../../utils/accountingExpression';
import { monthKeyToHeaderLabel } from '../../utils/accountingSheetModel';

function sumColumnOut(sheet, monthKey) {
  let s = 0;
  for (const row of sheet.expenseRows) {
    const cell = row.months && row.months[monthKey];
    if (!cell) continue;
    const v = evaluateArithmeticExpression(cell.out);
    if (Number.isFinite(v)) s += v;
  }
  return s;
}

export function AccountingExpenseTab({ sheet, setSheet }) {
  const [m0, m1] = sheet.monthKeys;

  const totals = useMemo(
    () => ({
      t0: sumColumnOut(sheet, m0),
      t1: sumColumnOut(sheet, m1)
    }),
    [sheet, m0, m1]
  );

  const patchOut = (categoryKey, monthKey, expr) => {
    setSheet((prev) => ({
      ...prev,
      expenseRows: prev.expenseRows.map((r) =>
        r.categoryKey === categoryKey
          ? {
              ...r,
              months: {
                ...r.months,
                [monthKey]: { out: expr }
              }
            }
          : r
      )
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
        <h3 className="text-lg font-semibold">支出记录 · EXPENSES</h3>
        <p className="text-xs text-blue-100 mt-1">固定类目，双月 OUT；与 xlsx EXPENSES 表一致。</p>
      </div>
      <table className="min-w-[640px] w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-900 text-white">
            <th className="p-2 text-left border border-gray-700 w-40">ITEM</th>
            <th className="p-2 text-center border border-gray-700 font-semibold">
              {monthKeyToHeaderLabel(m0)}
            </th>
            <th className="p-2 text-center border border-gray-700 font-semibold">
              {monthKeyToHeaderLabel(m1)}
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.expenseRows.map((row) => (
            <tr key={row.categoryKey} className="border-b border-gray-100">
              <td className="p-2 font-medium text-gray-800 border border-gray-100">{row.categoryKey}</td>
              <td className="p-1 border border-gray-100">
                <AccountingFormulaCell
                  valueExpr={(row.months[m0] || {}).out || ''}
                  onCommit={(v) => patchOut(row.categoryKey, m0, v)}
                />
              </td>
              <td className="p-1 border border-gray-100">
                <AccountingFormulaCell
                  valueExpr={(row.months[m1] || {}).out || ''}
                  onCommit={(v) => patchOut(row.categoryKey, m1, v)}
                />
              </td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
            <td className="p-2 border border-gray-200">Total</td>
            <td className="p-2 border border-gray-200 text-right">
              {formatAccountingNumber(totals.t0)}
            </td>
            <td className="p-2 border border-gray-200 text-right">
              {formatAccountingNumber(totals.t1)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
