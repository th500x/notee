import { Fragment, useMemo } from 'react';
import { AccountingFormulaCell } from './AccountingFormulaCell';
import { AccountingDateIsoCell } from './AccountingDateIsoCell';
import {
  emptyRentMonthCells,
  emptyRentRow,
  monthKeyToHeaderLabel,
  computeSettleFromInOut
} from '../../utils/accountingSheetModel';
import { formatAccountingNumber } from '../../utils/accountingExpression';

const inputCls =
  'w-full min-w-0 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100';

const narrowTextCls = `${inputCls} truncate cursor-help max-w-[min(12rem,22vw)]`;

function updateRentRow(sheet, rowId, updater) {
  return {
    ...sheet,
    rentRows: sheet.rentRows.map((r) => (r.id === rowId ? updater(r) : r))
  };
}

function sumMonthSettle(sheet, monthKey) {
  let s = 0;
  for (const row of sheet.rentRows) {
    const cell = row.months && row.months[monthKey];
    if (!cell) continue;
    const v = computeSettleFromInOut(cell);
    if (Number.isFinite(v)) s += v;
  }
  return s;
}

export function AccountingRentTab({ sheet, setSheet }) {
  const [m0, m1] = sheet.monthKeys;

  const totals = useMemo(
    () => ({
      m0Settle: sumMonthSettle(sheet, m0),
      m1Settle: sumMonthSettle(sheet, m1)
    }),
    [sheet, m0, m1]
  );

  const patchMonthCell = (rowId, monthKey, field, expr) =>
    setSheet((prev) =>
      updateRentRow(prev, rowId, (r) => ({
        ...r,
        months: {
          ...r.months,
          [monthKey]: {
            ...(r.months[monthKey] || emptyRentMonthCells()),
            [field]: expr
          }
        }
      }))
    );

  const patchDetail = (rowId, field, value) =>
    setSheet((prev) =>
      updateRentRow(prev, rowId, (r) => ({
        ...r,
        [field]: value
      }))
    );

  const addRow = () => {
    setSheet((prev) => ({
      ...prev,
      rentRows: [...prev.rentRows, emptyRentRow(prev.monthKeys)]
    }));
  };

  const removeRow = (rowId) => {
    setSheet((prev) => ({
      ...prev,
      rentRows: prev.rentRows.filter((r) => r.id !== rowId)
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
        <h3 className="text-lg font-semibold">租金记录 · INCOME</h3>
        <p className="text-xs text-blue-100 mt-1">
          申报 / 实际为完整日期；交租仅填月/日（年份取该列月份）；SETTLE = IN − OUT 自动计算；收入汇总以此为准。
        </p>
      </div>
      <table className="min-w-[1100px] w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-900 text-white">
            <th colSpan={7} className="p-2 text-center font-semibold border border-gray-700">
              DETAILS
            </th>
            <th colSpan={4} className="p-2 text-center font-semibold border border-gray-700">
              {monthKeyToHeaderLabel(m0)}
            </th>
            <th colSpan={4} className="p-2 text-center font-semibold border border-gray-700">
              {monthKeyToHeaderLabel(m1)}
            </th>
            <th className="p-2 w-14 border border-gray-700" />
          </tr>
          <tr className="bg-gray-800 text-white text-xs">
            <th className="p-2 border border-gray-700 text-left">ROOM</th>
            <th className="p-2 border border-gray-700 text-left">申报</th>
            <th className="p-2 border border-gray-700 text-left">实际</th>
            <th className="p-2 border border-gray-700 text-left">中介</th>
            <th className="p-2 border border-gray-700 text-left">备注</th>
            <th className="p-2 border border-gray-900 bg-black text-left">PRICE</th>
            <th className="p-2 border border-gray-900 bg-black text-left">DEPOSIT</th>
            {['IN', 'OUT', 'SETTLE', '交租'].map((h) => (
              <th key={`${m0}-${h}`} className="p-2 border border-gray-700 font-medium">
                {h}
              </th>
            ))}
            {['IN', 'OUT', 'SETTLE', '交租'].map((h) => (
              <th key={`${m1}-${h}`} className="p-2 border border-gray-700 font-medium">
                {h}
              </th>
            ))}
            <th className="p-2 border border-gray-700" />
          </tr>
        </thead>
        <tbody>
          {sheet.rentRows.length === 0 ? (
            <tr>
              <td colSpan={16} className="p-8 text-center text-gray-500">
                暂无房间行，请点击下方「添加行」。
              </td>
            </tr>
          ) : (
            <>
            {sheet.rentRows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                <td className="p-1 border border-gray-100">
                  <input
                    className={inputCls}
                    value={row.room}
                    onChange={(e) => patchDetail(row.id, 'room', e.target.value)}
                  />
                </td>
                <td className="p-1 border border-gray-100">
                  <AccountingDateIsoCell
                    valueIso={row.declaration}
                    onCommit={(v) => patchDetail(row.id, 'declaration', v)}
                    variant="ymd"
                  />
                </td>
                <td className="p-1 border border-gray-100">
                  <AccountingDateIsoCell
                    valueIso={row.actualRent}
                    onCommit={(v) => patchDetail(row.id, 'actualRent', v)}
                    variant="ymd"
                  />
                </td>
                <td className="p-1 border border-gray-100 max-w-[min(12rem,22vw)]">
                  <input
                    className={narrowTextCls}
                    value={row.agency}
                    title={row.agency && row.agency.trim() ? row.agency : undefined}
                    onChange={(e) => patchDetail(row.id, 'agency', e.target.value)}
                  />
                </td>
                <td className="p-1 border border-gray-100 max-w-[min(12rem,22vw)]">
                  <input
                    className={narrowTextCls}
                    value={row.remarks}
                    title={row.remarks && row.remarks.trim() ? row.remarks : undefined}
                    onChange={(e) => patchDetail(row.id, 'remarks', e.target.value)}
                  />
                </td>
                <td className="p-1 border border-gray-100 bg-gray-50">
                  <AccountingFormulaCell
                    valueExpr={row.price}
                    onCommit={(v) => patchDetail(row.id, 'price', v)}
                  />
                </td>
                <td className="p-1 border border-gray-100 bg-gray-50">
                  <AccountingFormulaCell
                    valueExpr={row.deposit}
                    onCommit={(v) => patchDetail(row.id, 'deposit', v)}
                  />
                </td>
                {[m0, m1].map((mk) => {
                  const cell = row.months[mk] || emptyRentMonthCells();
                  const settleVal = computeSettleFromInOut(cell);
                  const settleTitle = `SETTLE = IN − OUT → ${formatAccountingNumber(settleVal)}（IN: ${cell.in || '—'} · OUT: ${cell.out || '—'}）`;
                  return (
                    <Fragment key={`${row.id}-${mk}-block`}>
                      <td className="p-1 border border-gray-100">
                        <AccountingFormulaCell
                          valueExpr={cell.in || ''}
                          onCommit={(v) => patchMonthCell(row.id, mk, 'in', v)}
                        />
                      </td>
                      <td className="p-1 border border-gray-100">
                        <AccountingFormulaCell
                          valueExpr={cell.out || ''}
                          onCommit={(v) => patchMonthCell(row.id, mk, 'out', v)}
                        />
                      </td>
                      <td className="p-1 border border-gray-100 bg-slate-50">
                        <div
                          className="min-h-[2.25rem] w-full min-w-[4.5rem] border border-gray-200 rounded px-2 py-1.5 text-sm text-right font-mono text-gray-800 cursor-help"
                          title={settleTitle}
                        >
                          {formatAccountingNumber(settleVal)}
                        </div>
                      </td>
                      <td className="p-1 border border-gray-100">
                        <AccountingDateIsoCell
                          valueIso={cell.payRent || ''}
                          onCommit={(v) => patchMonthCell(row.id, mk, 'payRent', v)}
                          variant="md"
                          anchorMonthKey={mk}
                        />
                      </td>
                    </Fragment>
                  );
                })}
                <td className="p-1 border border-gray-100 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="text-red-600 hover:text-red-800 text-xs px-1"
                  >
                    删
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
              <td colSpan={9} className="p-2 border border-gray-200">
                Total
              </td>
              <td className="p-2 border border-gray-200 text-right bg-slate-100">
                {formatAccountingNumber(totals.m0Settle)}
              </td>
              <td className="p-2 border border-gray-200 text-center text-gray-400">—</td>
              <td colSpan={2} className="p-2 border border-gray-200 bg-gray-50" aria-hidden="true" />
              <td className="p-2 border border-gray-200 text-right bg-slate-100">
                {formatAccountingNumber(totals.m1Settle)}
              </td>
              <td className="p-2 border border-gray-200 text-center text-gray-400">—</td>
              <td className="p-2 border border-gray-200" />
            </tr>
            </>
          )}
        </tbody>
      </table>
      <div className="p-4 border-t border-gray-100">
        <button
          type="button"
          onClick={addRow}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + 添加行
        </button>
      </div>
    </div>
  );
}
