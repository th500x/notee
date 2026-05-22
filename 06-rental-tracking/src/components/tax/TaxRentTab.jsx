import { useMemo, useCallback } from 'react';
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

/** dnd-kit 静止时勿写恒等 transform 到 tr（与账目单 AccountingRentTab 一致） */
function sortableTransformIsActive(t) {
  if (t == null) return false;
  const x = t.x ?? 0;
  const y = t.y ?? 0;
  const sx = t.scaleX ?? 1;
  const sy = t.scaleY ?? 1;
  return x !== 0 || y !== 0 || sx !== 1 || sy !== 1;
}

const inputCls =
  'w-full min-w-0 min-h-[2.25rem] box-border px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100';

const narrowTextCls = `${inputCls} truncate`;

const COMPACT_COL_TD = 'max-w-[8rem] min-w-[4rem] align-top box-border';

const ROOM_COL_TD = 'w-[8.5rem] min-w-[4rem] max-w-[8.5rem] align-top box-border';

const DETAIL_FIELDS = [
  { key: 'roomNo', label: 'ROOM No.' },
  { key: 'condo', label: 'Condo' },
  { key: 'owner', label: 'Owner' },
  { key: 'passport', label: 'Passport' },
  { key: 'taxNo', label: 'TAX No.' },
  { key: 'note', label: 'Note' }
];

function updateTaxRow(sheet, rowId, updater) {
  return {
    ...sheet,
    rows: sheet.rows.map((r) => (r.id === rowId ? updater(r) : r))
  };
}

function SortableTaxRow({ row, rowIndex, patchField, removeRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id
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
            data-tax-drag-handle
            className="shrink-0 flex flex-col items-center justify-center w-7 rounded border border-transparent text-gray-500 touch-none select-none hover:border-gray-300 hover:bg-gray-100 cursor-grab active:cursor-grabbing"
            aria-label="拖动排序"
            title="按住左侧 ⋮ 柄拖动以调整行顺序"
            {...attributes}
            {...listeners}
          >
            <span className="text-[10px] leading-none tracking-tighter opacity-80">⋮</span>
            <span className="text-[10px] leading-none tracking-tighter opacity-80 -mt-0.5">⋮</span>
          </button>
          <input
            className={inputCls}
            value={row.room}
            onChange={(e) => patchField(row.id, 'room', e.target.value)}
            aria-label={`ROOM 行 ${rowIndex + 1}`}
          />
        </div>
      </td>
      {DETAIL_FIELDS.map(({ key, label }) => (
        <td key={key} className={`p-1 border border-gray-100 ${COMPACT_COL_TD}`}>
          <input
            className={key === 'note' ? inputCls : narrowTextCls}
            value={row[key] ?? ''}
            title={row[key] && String(row[key]).trim() ? row[key] : undefined}
            onChange={(e) => patchField(row.id, key, e.target.value)}
            aria-label={`${label} 行 ${rowIndex + 1}`}
          />
        </td>
      ))}
      <td className={`p-1 border border-gray-100 ${COMPACT_COL_TD} text-center align-middle`}>
        <button
          type="button"
          onClick={() => removeRow(row.id)}
          className="min-h-[2.25rem] px-2 text-red-600 hover:text-red-800 text-xs font-medium"
        >
          删
        </button>
      </td>
    </tr>
  );
}

export function TaxRentTab({ sheet, setSheet, sourceLabel }) {
  const patchField = (rowId, field, value) => {
    setSheet((prev) =>
      updateTaxRow(prev, rowId, (r) => ({
        ...r,
        [field]: value
      }))
    );
  };

  const removeRow = (rowId) => {
    setSheet((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== rowId)
    }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const sortableIds = useMemo(() => sheet.rows.map((r) => r.id), [sheet.rows]);

  const onDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setSheet((prev) => {
        const rows = prev.rows;
        const oldIndex = rows.findIndex((r) => r.id === active.id);
        const newIndex = rows.findIndex((r) => r.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return { ...prev, rows: arrayMove(rows, oldIndex, newIndex) };
      });
    },
    [setSheet]
  );

  const colSpan = 1 + DETAIL_FIELDS.length + 1;

  return (
    <div className="w-full min-w-0">
      <div className="inline-block min-w-full max-w-none align-top bg-white rounded-lg shadow-md box-border">
        <div className="w-full min-w-0 bg-gradient-to-r from-blue-500 to-purple-600 px-4 sm:px-6 py-3 sm:py-4 text-white box-border">
          <h3 className="text-lg font-semibold">税费登记 · TAX</h3>
          {sourceLabel ? (
            <p className="text-xs text-blue-100 mt-1">房源来源：{sourceLabel}</p>
          ) : null}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <table className="min-w-full w-max max-w-none text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-gray-800 text-white text-xs">
                <th
                  className={`p-2 border border-gray-700 text-center align-middle ${ROOM_COL_TD} bg-gray-800`}
                >
                  ROOM
                </th>
                {DETAIL_FIELDS.map(({ label }) => (
                  <th
                    key={label}
                    className={`p-2 border border-gray-700 text-center align-middle ${COMPACT_COL_TD}`}
                  >
                    {label}
                  </th>
                ))}
                <th
                  className={`p-2 border border-gray-700 text-center align-middle ${COMPACT_COL_TD}`}
                >
                  删
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="p-8 text-center text-gray-500">
                    暂无 ROOM 行，请点击页面底部「添加条目」。
                  </td>
                </tr>
              ) : (
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {sheet.rows.map((row, rowIndex) => (
                    <SortableTaxRow
                      key={row.id}
                      row={row}
                      rowIndex={rowIndex}
                      patchField={patchField}
                      removeRow={removeRow}
                    />
                  ))}
                </SortableContext>
              )}
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
