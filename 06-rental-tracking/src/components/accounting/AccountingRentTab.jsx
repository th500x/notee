import { Fragment, useMemo, useRef, useCallback, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
  monthKeyToHeaderLabel,
  computeSettleFromInOut
} from '../../utils/accountingSheetModel';
import { evaluateArithmeticExpression, formatAccountingNumber } from '../../utils/accountingExpression';
import { isIsoDateString, sanitizeIsoDateField, isMonthBeforeActualRent } from '../../utils/accountingDates';
import { AccountingRowGalleryModal } from './AccountingRowGalleryModal';
import { AccountingAutoTextareaCell } from './AccountingAutoTextareaCell';
import { uploadService } from '../../services/uploadService';

/** dnd-kit 在静止时也可能给出恒等 transform；写在 tr 上会给子格新建包含块，恒等时勿写 transform */
function sortableTransformIsActive(t) {
  if (t == null) return false;
  const x = t.x ?? 0;
  const y = t.y ?? 0;
  const sx = t.scaleX ?? 1;
  const sy = t.scaleY ?? 1;
  return x !== 0 || y !== 0 || sx !== 1 || sy !== 1;
}

/** 与公式格 / 日期格相同的可视高度与边框，保证各行「框体」一致 */
const inputCls =
  'w-full min-w-0 min-h-[2.25rem] box-border px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100';

const narrowTextCls = `${inputCls} truncate cursor-help`;

/** 与公式列一致最小宽度 4rem；上限 8rem，避免中介/备注等与日期列被拉得过宽 */
const COMPACT_COL_TD =
  'max-w-[8rem] min-w-[4rem] align-top box-border';

/** ROOM：仅满足房号短码；含左侧拖动手柄的整列宽，避免再占 26% 表宽 */
const ROOM_COL_TD = 'w-[8.5rem] min-w-[4rem] max-w-[8.5rem] align-top box-border';
const ROOM_COL_TH = ROOM_COL_TD;

/** 可录入格：ROOM(0)…备注(4)、PRICE(5)、DEPOSIT(6)、双月 IN/OUT/交租（右月交租为列 14），不含只读 SETTLE、镜像 ROOM 与删钮 */
const RENT_GRID_COL_MAX = 14;

/** 「实际」有日期、列月不早于入住月，且该月交租仍为空 — 交租格红横杠；筛选仅看右列 m1 */
function shouldHighlightEmptyPayRent(row, monthKey, cell) {
  const actual = sanitizeIsoDateField(row.actualRent);
  if (!isIsoDateString(actual)) return false;
  if (isMonthBeforeActualRent(monthKey, actual)) return false;
  return !isIsoDateString(sanitizeIsoDateField(cell?.payRent || ''));
}

function rowHasPendingPayRentPlaceholder(row, currentMonthKey) {
  const cell = row.months?.[currentMonthKey] || emptyRentMonthCells();
  return shouldHighlightEmptyPayRent(row, currentMonthKey, cell);
}

function sumMonthSettleRows(rows, monthKey) {
  let s = 0;
  for (const row of rows) {
    const cell = row.months && row.months[monthKey];
    if (!cell) continue;
    const v = computeSettleFromInOut(cell);
    if (Number.isFinite(v)) s += v;
  }
  return s;
}

function updateRentRow(sheet, rowId, updater) {
  return {
    ...sheet,
    rentRows: sheet.rentRows.map((r) => (r.id === rowId ? updater(r) : r))
  };
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
  removeRow,
  sortableDisabled,
  onOpenGallery
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: sortableDisabled
  });

  const dragT = sortableTransformIsActive(transform);
  const style = {
    ...(dragT ? { transform: CSS.Transform.toString(transform), transition } : {}),
    ...(isDragging ? { opacity: 0.92, zIndex: 2, position: 'relative' } : {})
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-100 hover:bg-gray-50/80 ${isDragging ? 'bg-blue-50/90 shadow-sm ring-1 ring-blue-200/80' : ''}`}
    >
      <td
        className={`p-1 border border-gray-100 ${ROOM_COL_TD} ${
          isDragging ? 'bg-blue-50/95' : 'bg-white'
        }`}
      >
        <div className="flex items-stretch gap-1 min-w-0">
          <button
            type="button"
            data-rent-drag-handle
            className={`shrink-0 flex flex-col items-center justify-center w-7 rounded border border-transparent text-gray-500 touch-none select-none ${
              sortableDisabled
                ? 'opacity-40 cursor-not-allowed pointer-events-none'
                : 'hover:border-gray-300 hover:bg-gray-100 cursor-grab active:cursor-grabbing'
            }`}
            aria-label="拖动排序"
            title={
              sortableDisabled
                ? '筛选模式下不可拖动排序，请先关闭「筛选」'
                : '按住左侧 ⋮ 柄拖动以调整行顺序'
            }
            {...attributes}
            {...listeners}
          >
            <span className="text-[10px] leading-none tracking-tighter opacity-80">⋮</span>
            <span className="text-[10px] leading-none tracking-tighter opacity-80 -mt-0.5">⋮</span>
          </button>
          <input
            className={inputCls}
            value={row.room}
            data-rent-nav={`${rowIndex}-0`}
            onChange={(e) => patchDetail(row.id, 'room', e.target.value)}
            onKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 0)}
          />
        </div>
      </td>
      <td className={`p-1 border border-gray-100 ${COMPACT_COL_TD}`}>
        <AccountingDateIsoCell
          valueIso={row.declaration}
          onCommit={(v) => patchDetail(row.id, 'declaration', v)}
          variant="ymd"
          emphasizeIfCurrentMonth
          rentNavSlot={`${rowIndex}-1`}
          onGridArrowKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 1)}
        />
      </td>
      <td className={`p-1 border border-gray-100 ${COMPACT_COL_TD}`}>
        <AccountingDateIsoCell
          valueIso={row.actualRent}
          onCommit={(v) => patchDetail(row.id, 'actualRent', v)}
          variant="ymd"
          emphasizeIfCurrentMonth
          rentNavSlot={`${rowIndex}-2`}
          onGridArrowKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 2)}
        />
      </td>
      <td className={`p-1 border border-gray-100 ${COMPACT_COL_TD}`}>
        <input
          className={narrowTextCls}
          value={row.agency}
          data-rent-nav={`${rowIndex}-3`}
          title={row.agency && row.agency.trim() ? row.agency : undefined}
          onChange={(e) => patchDetail(row.id, 'agency', e.target.value)}
          onKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 3)}
        />
      </td>
      <td className={`p-1 border border-gray-100 ${COMPACT_COL_TD}`}>
        <AccountingAutoTextareaCell
          value={row.remarks}
          rentNavSlot={`${rowIndex}-4`}
          title={row.remarks && row.remarks.trim() ? row.remarks : undefined}
          onChange={(e) => patchDetail(row.id, 'remarks', e.target.value)}
          onGridArrowKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, 4)}
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
                className="min-h-[2.25rem] w-full min-w-[4rem] border border-gray-200 rounded px-2 py-1.5 text-sm text-right font-mono text-gray-800 cursor-help"
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
                mdEmptyAsRed={shouldHighlightEmptyPayRent(row, mk, cell)}
                rentNavSlot={`${rowIndex}-${baseCol + 3}`}
                onGridArrowKeyDown={(e) => handleRentNavKeyDown(e, rowIndex, baseCol + 3)}
              />
            </td>
          </Fragment>
        );
      })}
      <td
        className={`p-1 border border-gray-100 ${COMPACT_COL_TD} bg-slate-50`}
        title="只读：与左侧房号同步"
      >
        <div className="min-h-[2.25rem] w-full min-w-0 box-border px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-800 truncate tabular-nums">
          {row.room ? String(row.room) : '—'}
        </div>
      </td>
      <td className={`p-1 border border-gray-100 text-center align-middle ${COMPACT_COL_TD}`}>
        <div className="flex items-center justify-center gap-1 min-h-[2.25rem]">
          <button
            type="button"
            onClick={(e) => onOpenGallery(row.id, e.currentTarget)}
            className="text-blue-600 hover:text-blue-800 text-xs px-0.5"
            title={
              row.photos?.length
                ? `图片库（${row.photos.length} 张 OSS）`
                : row.galleryDriveFolderUrl?.trim()
                  ? '图片库（已配置 Google Drive）'
                  : '上传图片 / 配置图库'
            }
          >
            图
            {row.photos?.length
              ? `(${row.photos.length})`
              : row.galleryDriveFolderUrl?.trim()
                ? '●'
                : ''}
          </button>
          <button
            type="button"
            onClick={() => removeRow(row.id)}
            className="text-red-600 hover:text-red-800 text-xs px-0.5"
          >
            删
          </button>
        </div>
      </td>
    </tr>
  );
}

export function AccountingRentTab({
  sheet,
  savedSheet,
  setSheet,
  isRentRowGalleryUnsaved,
  onSaveToServer,
  saving
}) {
  const [m0, m1] = sheet.monthKeys;
  const [filterPendingPayRent, setFilterPendingPayRent] = useState(false);
  /** 开启筛选时固定的行 id：补录交租后仍保留在列表中，避免行瞬间消失像「输入无效」 */
  const [filterPinnedRowIds, setFilterPinnedRowIds] = useState(null);
  const [galleryRowId, setGalleryRowId] = useState(null);
  const [galleryAnchorEl, setGalleryAnchorEl] = useState(null);
  const rentTableRef = useRef(null);

  const handleOpenGallery = useCallback((rowId, anchorEl) => {
    if (anchorEl?.scrollIntoView) {
      anchorEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    setGalleryRowId(rowId);
    setGalleryAnchorEl(anchorEl || null);
  }, []);

  const handleCloseGallery = useCallback(() => {
    setGalleryRowId(null);
    setGalleryAnchorEl(null);
  }, []);

  const galleryRow = useMemo(
    () => (galleryRowId ? sheet.rentRows.find((r) => r.id === galleryRowId) : null),
    [galleryRowId, sheet.rentRows]
  );

  const gallerySavedRow = useMemo(
    () => (galleryRowId ? savedSheet?.rentRows?.find((r) => r.id === galleryRowId) : null),
    [galleryRowId, savedSheet?.rentRows]
  );

  const displayRows = useMemo(() => {
    if (!filterPendingPayRent) return sheet.rentRows;
    return sheet.rentRows.filter(
      (r) =>
        rowHasPendingPayRentPlaceholder(r, m1) ||
        (filterPinnedRowIds != null && filterPinnedRowIds.has(r.id))
    );
  }, [sheet.rentRows, filterPendingPayRent, m1, filterPinnedRowIds]);

  const toggleFilterPendingPayRent = useCallback(() => {
    setFilterPendingPayRent((on) => {
      const next = !on;
      if (next) {
        setFilterPinnedRowIds(
          new Set(
            sheet.rentRows
              .filter((r) => rowHasPendingPayRentPlaceholder(r, m1))
              .map((r) => r.id)
          )
        );
      } else {
        setFilterPinnedRowIds(null);
      }
      return next;
    });
  }, [sheet.rentRows, m1]);

  const sensors = useSensors(
    // 监听器仅在拖动手柄上：Pointer 即可覆盖触控，避免 TouchSensor 与横向滚动条抢 touchmove
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const sortableIds = useMemo(() => displayRows.map((r) => r.id), [displayRows]);

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
      m0Settle: sumMonthSettleRows(displayRows, m0),
      m1Settle: sumMonthSettleRows(displayRows, m1),
      priceSum: sumExprField(displayRows, 'price'),
      depositSum: sumExprField(displayRows, 'deposit')
    }),
    [displayRows, m0, m1]
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
      const rowCount = displayRows.length;
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
    [displayRows.length, focusRentCell]
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

  const removeRow = async (rowId) => {
    const row = sheet.rentRows.find((r) => r.id === rowId);
    if (!row) return;
    if (!confirm(`确定删除房号「${row.room || '（未填）'}」这一行？`)) return;

    if (row.photos?.length) {
      try {
        await uploadService.deletePhotos(row.photos.map((p) => p.id));
      } catch (err) {
        const stillRemove = window.confirm(
          `该行有 ${row.photos.length} 张云端图片，删除失败（${err.message || '未知错误'}）。仍从表格移除该行？`
        );
        if (!stillRemove) return;
      }
    }

    setSheet((prev) => ({
      ...prev,
      rentRows: prev.rentRows.filter((r) => r.id !== rowId)
    }));
    if (galleryRowId === rowId) {
      handleCloseGallery();
    }
  };

  const handleGalleryRowUpdate = (rowId, patch) => {
    setSheet((prev) =>
      updateRentRow(prev, rowId, (r) => ({
        ...r,
        ...patch
      }))
    );
  };

  return (
    <div className="w-full min-w-0">
      <div className="inline-block min-w-full max-w-none align-top bg-white rounded-lg shadow-md box-border">
        <div className="w-full min-w-0 bg-gradient-to-r from-blue-500 to-purple-600 px-4 sm:px-6 py-3 sm:py-4 text-white box-border">
          <h3 className="text-lg font-semibold">租金记录 · INCOME</h3>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <table
            ref={rentTableRef}
            className="min-w-full w-max max-w-none text-sm border-separate border-spacing-0"
          >
          <thead>
            <tr className="bg-gray-900 text-white">
              <th colSpan={7} className="p-2 text-center align-middle font-semibold border border-gray-700">
                DETAILS
              </th>
              <th colSpan={4} className="p-2 text-center align-middle font-semibold border border-gray-700">
                {monthKeyToHeaderLabel(m0)}
              </th>
              <th colSpan={4} className="p-2 text-center align-middle font-semibold border border-gray-700">
                {monthKeyToHeaderLabel(m1)}
              </th>
              <th
                className={`p-2 text-center align-middle font-semibold border border-gray-700 text-xs leading-tight ${COMPACT_COL_TD}`}
              >
                ROOM
                <span className="mt-0.5 block text-[10px] font-normal opacity-80">（镜像·只读）</span>
              </th>
              <th
                className={`p-2 text-center align-middle font-semibold border border-gray-700 ${COMPACT_COL_TD}`}
              />
            </tr>
            <tr className="bg-gray-800 text-white text-xs">
              <th
                className={`p-2 border border-gray-700 text-center align-middle ${ROOM_COL_TH} bg-gray-800`}
              >
                ROOM
              </th>
              <th className={`p-2 border border-gray-700 text-center align-middle ${COMPACT_COL_TD}`}>申报</th>
              <th className={`p-2 border border-gray-700 text-center align-middle ${COMPACT_COL_TD}`}>实际</th>
              <th
                className={`p-2 border border-gray-700 text-center align-middle font-medium ${COMPACT_COL_TD}`}
              >
                中介
              </th>
              <th
                className={`p-2 border border-gray-700 text-center align-middle font-medium ${COMPACT_COL_TD}`}
              >
                备注
              </th>
              <th className="p-2 border border-gray-900 bg-black text-center align-middle">PRICE</th>
              <th className="p-2 border border-gray-900 bg-black text-center align-middle">DEPOSIT</th>
              {['IN', 'OUT', 'SETTLE', '交租'].map((h) => (
                <th key={`${m0}-${h}`} className="p-2 border border-gray-700 font-medium text-center align-middle">
                  {h}
                </th>
              ))}
              {['IN', 'OUT', 'SETTLE', '交租'].map((h) => (
                <th key={`${m1}-${h}`} className="p-2 border border-gray-700 font-medium text-center align-middle">
                  {h}
                </th>
              ))}
              <th
                className={`p-2 border border-gray-700 text-center align-middle ${COMPACT_COL_TD} bg-gray-800`}
                title="只读：与左侧房号同步"
              >
                ROOM
              </th>
              <th
                className={`p-1 border border-gray-700 text-center align-middle ${COMPACT_COL_TD}`}
              >
                <button
                  type="button"
                  onClick={toggleFilterPendingPayRent}
                  className={`flex w-full min-h-[2.25rem] items-center justify-center rounded px-0.5 py-1 text-[10px] leading-tight font-semibold tracking-tight transition-colors ${
                    filterPendingPayRent
                      ? 'bg-amber-500 text-gray-900 shadow-sm'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                  title="开启后仅列出「实际」有日期且当月（右列）交租仍为空（红横杠）的房间；左月交租不参与筛选。再点恢复全部"
                >
                  筛选
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.rentRows.length === 0 ? (
              <tr>
                <td colSpan={17} className="p-8 text-center text-gray-500">
                  暂无房间行，请点击页面底部「添加条目」。
                </td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={17} className="p-8 text-center text-gray-500">
                  当前筛选下没有「交租待登记」的房间行，请关闭「筛选」或补录交租日期。
                </td>
              </tr>
            ) : (
              <>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {displayRows.map((row, rowIndex) => (
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
                      sortableDisabled={filterPendingPayRent}
                      onOpenGallery={handleOpenGallery}
                    />
                  ))}
                </SortableContext>
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                  <td colSpan={5} className="p-2 border border-gray-200 bg-gray-50">
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
                  <td className={`p-2 border border-gray-200 ${COMPACT_COL_TD} bg-gray-100 text-center text-gray-400`}>
                    —
                  </td>
                  <td className={`p-2 border border-gray-200 ${COMPACT_COL_TD}`} />
                </tr>
              </>
            )}
          </tbody>
          </table>
        </DndContext>
      </div>

      <AccountingRowGalleryModal
        isOpen={!!galleryRow}
        row={galleryRow}
        savedRow={gallerySavedRow}
        anchorEl={galleryAnchorEl}
        galleryUnsaved={galleryRow ? isRentRowGalleryUnsaved?.(galleryRow.id) : false}
        saving={saving}
        onSaveToServer={onSaveToServer}
        onClose={handleCloseGallery}
        onUpdateRow={handleGalleryRowUpdate}
      />
    </div>
  );
}
