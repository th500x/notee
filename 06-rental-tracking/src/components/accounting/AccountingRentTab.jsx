import { Fragment, useMemo, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AccountingFormulaCell } from './AccountingFormulaCell';
import { AccountingDateIsoCell } from './AccountingDateIsoCell';
import {
  emptyRentMonthCells,
  emptyRentRow,
  monthKeyToHeaderLabel,
  computeSettleFromInOut
} from '../../utils/accountingSheetModel';
import { evaluateArithmeticExpression, formatAccountingNumber } from '../../utils/accountingExpression';

const inputCls =
  'w-full min-w-0 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100';

const narrowTextCls = `${inputCls} truncate cursor-help max-w-[min(12rem,22vw)]`;

/** 可录入格：ROOM(0)…备注(4)、PRICE(5)、DEPOSIT(6)、双月 IN/OUT/交租(7–12)，不含只读 SETTLE 与删钮（与水电单表格方向键规则一致） */
const RENT_GRID_COL_MAX = 12;

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

function sumExprField(rows, field) {
  let s = 0;
  for (const row of rows) {
    const v = evaluateArithmeticExpression(row[field]);
    if (Number.isFinite(v)) s += v;
  }
  return s;
}

function SortableRentRow({
  row,
  rowIndex,
  m0,
  m1,
  patchDetail,
  patchMonthCell,
  handleRentNavKeyDown,
  removeRow
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.92, zIndex: 2, position: 'relative' } : {})
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-100 hover:bg-gray-50/80 ${isDragging ? 'bg-blue-50/90 shadow-sm ring-1 ring-blue-200/80' : ''}`}
    >
      <td className="p-1 border border-gray-100">
        <div className="flex items-stretch gap-1 min-w-0">
          <button
            type="button"
            className="shrink-0 flex flex-col items-center justify-center w-7 rounded border border-transparent hover:border-gray-300 hover:bg-gray-100 text-gray-500 cursor-grab active:cursor-grabbing touch-none select-none"
            aria-label="拖动排序（触控请长按）"
            title="拖动排序；触控可长按后再拖"
            {...attributes}
            {...listeners}
          >
            <span className="text-[10px] leading-none tracking-tighter opacity-80">⋮</span>
            <span className="text-[10px] leading-none tracking-tighter opacity-80 -mt-0.5">⋮</span>
          </button>
          <input
            className={`${inputCls} flex-1 min-w-0`}
            value={row.room}
            data-rent-nav={`${rowIndex}-0`}
            onChange={(e) => patchDetail(row.id, 'room', e.target.value)}
            onKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 0)}
          />
        </div>
      </td>
      <td className="p-1 border border-gray-100">
        <AccountingDateIsoCell
          valueIso={row.declaration}
          onCommit={(v) => patchDetail(row.id, 'declaration', v)}
          variant="ymd"
          emphasizeIfCurrentMonth
          rentNavSlot={`${rowIndex}-1`}
          onGridArrowKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 1)}
        />
      </td>
      <td className="p-1 border border-gray-100">
        <AccountingDateIsoCell
          valueIso={row.actualRent}
          onCommit={(v) => patchDetail(row.id, 'actualRent', v)}
          variant="ymd"
          emphasizeIfCurrentMonth
          rentNavSlot={`${rowIndex}-2`}
          onGridArrowKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 2)}
        />
      </td>
      <td className="p-1 border border-gray-100 max-w-[min(12rem,22vw)]">
        <input
          className={narrowTextCls}
          value={row.agency}
          data-rent-nav={`${rowIndex}-3`}
          title={row.agency && row.agency.trim() ? row.agency : undefined}
          onChange={(e) => patchDetail(row.id, 'agency', e.target.value)}
          onKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 3)}
        />
      </td>
      <td className="p-1 border border-gray-100 max-w-[min(12rem,22vw)]">
        <input
          className={narrowTextCls}
          value={row.remarks}
          data-rent-nav={`${rowIndex}-4`}
          title={row.remarks && row.remarks.trim() ? row.remarks : undefined}
          onChange={(e) => patchDetail(row.id, 'remarks', e.target.value)}
          onKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 4)}
        />
      </td>
      <td className="p-1 border border-gray-100 bg-gray-50">
        <AccountingFormulaCell
          valueExpr={row.price}
          onCommit={(v) => patchDetail(row.id, 'price', v)}
          rentNavSlot={`${rowIndex}-5`}
          onGridArrowKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 5)}
        />
      </td>
      <td className="p-1 border border-gray-100 bg-gray-50">
        <AccountingFormulaCell
          valueExpr={row.deposit}
          onCommit={(v) => patchDetail(row.id, 'deposit', v)}
          rentNavSlot={`${rowIndex}-6`}
          onGridArrowKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 6)}
        />
      </td>
      {[m0, m1].map((mk, mi) => {
        const cell = row.months[mk] || emptyRentMonthCells();
        const settleVal = computeSettleFromInOut(cell);
        const settleTitle = `SETTLE = IN − OUT → ${formatAccountingNumber(settleVal)}（IN: ${cell.in || '—'} · OUT: ${cell.out || '—'}）`;
        const baseCol = 7 + mi * 4;
        return (
          <Fragment key={`${row.id}-${mk}-block`}>
            <td className="p-1 border border-gray-100">
              <AccountingFormulaCell
                valueExpr={cell.in || ''}
                onCommit={(v) => patchMonthCell(row.id, mk, 'in', v)}
                rentNavSlot={`${rowIndex}-${baseCol}`}
                onGridArrowKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, baseCol)}
              />
            </td>
            <td className="p-1 border border-gray-100">
              <AccountingFormulaCell
                valueExpr={cell.out || ''}
                onCommit={(v) => patchMonthCell(row.id, mk, 'out', v)}
                rentNavSlot={`${rowIndex}-${baseCol + 1}`}
                onGridArrowKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, baseCol + 1)}
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
                rentNavSlot={`${rowIndex}-${baseCol + 3}`}
                onGridArrowKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, baseCol + 3)}
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
  );
}

export function AccountingRentTab({ sheet, setSheet }) {
  const [m0, m1] = sheet.monthKeys;
  const rentTableRef = useRef(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 10 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 280,
        tolerance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const sortableIds = useMemo(() => sheet.rentRows.map((r) => r.id), [sheet.rentRows]);

  const onDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setSheet((prev) => {
        const rows = prev.rentRows;
        const oldIndex = rows.findIndex((r) => r.id === active.id);
        const newIndex = rows.findIndex((r) => r.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return { ...prev, rentRows: arrayMove(rows, oldIndex, newIndex) };
      });
    },
    [setSheet]
  );

  const totals = useMemo(
    () => ({
      m0Settle: sumMonthSettle(sheet, m0),
      m1Settle: sumMonthSettle(sheet, m1),
      priceSum: sumExprField(sheet.rentRows, 'price'),
      depositSum: sumExprField(sheet.rentRows, 'deposit')
    }),
    [sheet, m0, m1]
  );

  const focusRentCell = useCallback((rowIndex, colIndex) => {
    requestAnimationFrame(() => {
      const root = rentTableRef.current;
      const el = root?.querySelector(`[data-rent-nav="${rowIndex}-${colIndex}"]`) ?? null;
      if (el && typeof el.focus === 'function') {
        el.focus();
        if (typeof el.select === 'function') {
          try {
            el.select();
          } catch {
            /* ignore */
          }
        }
      }
    });
  }, []);

  const handleRentNavKeyDown = useCallback(
    (e, rowIndex, colIndex) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const rowCount = sheet.rentRows.length;
      if (rowCount === 0) return;
      e.preventDefault();
      e.stopPropagation();

      const maxC = RENT_GRID_COL_MAX;
      let r = rowIndex;
      let c = colIndex;

      if (e.key === 'ArrowUp') {
        if (r <= 0) return;
        r -= 1;
      } else if (e.key === 'ArrowDown') {
        if (r >= rowCount - 1) return;
        r += 1;
      } else if (e.key === 'ArrowLeft') {
        if (c > 0) {
          c -= 1;
        } else if (rowIndex > 0) {
          r = rowIndex - 1;
          c = maxC;
        } else {
          return;
        }
      } else if (e.key === 'ArrowRight') {
        if (c < maxC) {
          c += 1;
        } else if (rowIndex < rowCount - 1) {
          r = rowIndex + 1;
          c = 0;
        } else {
          return;
        }
      }

      focusRentCell(r, c);
    },
    [sheet.rentRows.length, focusRentCell]
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
          申报 / 实际为完整日期；交租仅填月/日（年份取该列月份）；SETTLE = IN − OUT 自动计算；收入汇总以此为准。PRICE/DEPOSIT
          合计为各行公式求值之和；录入时光标在格内时可用 ↑↓←→ 在格间移动（与水电单一致）。ROOM
          左侧握柄可拖动排序；鼠标拖动约 10px 起拖，触控请长按约 0.28s 后再拖。
        </p>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table ref={rentTableRef} className="min-w-[1100px] w-full text-sm border-collapse">
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
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {sheet.rentRows.map((row, rowIndex) => (
                    <SortableRentRow
                      key={row.id}
                      row={row}
                      rowIndex={rowIndex}
                      m0={m0}
                      m1={m1}
                      patchDetail={patchDetail}
                      patchMonthCell={patchMonthCell}
                      handleRentNavKeyDown={handleRentNavKeyDown}
                      removeRow={removeRow}
                    />
                  ))}
                </SortableContext>
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                  <td colSpan={5} className="p-2 border border-gray-200">
                    Total
                  </td>
                  <td className="p-2 border border-gray-200 text-right bg-gray-100 font-mono">
                    {formatAccountingNumber(totals.priceSum)}
                  </td>
                  <td className="p-2 border border-gray-200 text-right bg-gray-100 font-mono">
                    {formatAccountingNumber(totals.depositSum)}
                  </td>
                  <td
                    colSpan={2}
                    className="p-2 border border-gray-200 text-center text-gray-400 text-xs font-normal"
                  >
                    —
                  </td>
                  <td className="p-2 border border-gray-200 text-right bg-slate-100">
                    {formatAccountingNumber(totals.m0Settle)}
                  </td>
                  <td className="p-2 border border-gray-200 text-center text-gray-400">—</td>
                  <td
                    colSpan={2}
                    className="p-2 border border-gray-200 text-center text-gray-400 text-xs font-normal"
                  >
                    —
                  </td>
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
      </DndContext>
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
