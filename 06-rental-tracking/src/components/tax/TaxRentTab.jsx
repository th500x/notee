/** 税费单表格：ROOM 列版式与账目单租金表一致 */

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

function TaxDataRow({ row, rowIndex, patchField, removeRow }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/80">
      <td className={`p-1 border border-gray-100 ${ROOM_COL_TD} bg-white`}>
        <div className="flex items-stretch gap-1 min-w-0">
          <span
            className="shrink-0 flex flex-col items-center justify-center w-7 rounded border border-transparent text-gray-300 touch-none select-none opacity-50"
            title="税费单 ROOM 与来源账目单同步，可在此编辑房号"
            aria-hidden
          >
            <span className="text-[10px] leading-none tracking-tighter">⋮</span>
            <span className="text-[10px] leading-none tracking-tighter -mt-0.5">⋮</span>
          </span>
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
              sheet.rows.map((row, rowIndex) => (
                <TaxDataRow
                  key={row.id}
                  row={row}
                  rowIndex={rowIndex}
                  patchField={patchField}
                  removeRow={removeRow}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
