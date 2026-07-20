import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import * as api from '../utils/apiClient'
import {
  addCalendarDaysIsoYmd,
  isUtilityReadingPeriodOrderValid,
  sanitizeOptionalIsoYmd,
  todayLocalIsoYmd
} from '../utils/utilityBillingPeriod'

function emptySheet() {
  return {
    pricePerKwh: 0,
    pricePerWaterUnit: 0,
    readingMonthText: '',
    readingDateText: '',
    readingPeriodStartIso: '',
    readingPeriodEndIso: '',
    rows: []
  }
}

function normalizeSheet(raw) {
  if (!raw || typeof raw !== 'object') return emptySheet()
  return {
    pricePerKwh: Number(raw.pricePerKwh) || 0,
    pricePerWaterUnit: Number(raw.pricePerWaterUnit) || 0,
    readingMonthText: typeof raw.readingMonthText === 'string' ? raw.readingMonthText : '',
    readingDateText: typeof raw.readingDateText === 'string' ? raw.readingDateText : '',
    readingPeriodStartIso: sanitizeOptionalIsoYmd(raw.readingPeriodStartIso),
    readingPeriodEndIso: sanitizeOptionalIsoYmd(raw.readingPeriodEndIso),
    rows: Array.isArray(raw.rows) ? raw.rows : []
  }
}

function newRowId() {
  return `ub-row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function computeRow(row, pricePerKwh, pricePerWaterUnit) {
  const le = Number(row.lastMonthElectric) || 0
  const ce = Number(row.currentMonthElectric) || 0
  const lw = Number(row.lastMonthWater) || 0
  const cw = Number(row.currentMonthWater) || 0
  const electricUnits = Math.max(0, ce - le)
  const waterUnits = Math.max(0, cw - lw)
  const pk = Number(pricePerKwh) || 0
  const pw = Number(pricePerWaterUnit) || 0
  const subtotal = electricUnits * pk + waterUnits * pw
  return { electricUnits, waterUnits, subtotal }
}

/** Meter table editable columns: Unit, last elec, curr elec, last water, curr water (same order as DOM). */
const METER_GRID_COL_COUNT = 5

/**
 * Utility bill page (English UI only).
 */
export default function UtilityBillPage({ project, onBack, onSaved }) {
  const [sheet, setSheet] = useState(() => normalizeSheet(project?.utilitySheet))
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [exportPickerOpen, setExportPickerOpen] = useState(false)
  /** row id -> include in PNG export */
  const [exportRowSelected, setExportRowSelected] = useState({})
  const [exportPickerNotice, setExportPickerNotice] = useState('')
  const meterTableRootRef = useRef(null)

  const focusMeterCell = useCallback((rowIndex, colIndex) => {
    requestAnimationFrame(() => {
      const root = meterTableRootRef.current
      const el = root?.querySelector(`[data-ub-meter="${rowIndex}-${colIndex}"]`) ?? null
      if (el && typeof el.focus === 'function') {
        el.focus()
        if (typeof el.select === 'function') {
          try {
            el.select()
          } catch {
            /* ignore */
          }
        }
      }
    })
  }, [])

  const handleMeterCellKeyDown = useCallback(
    (e, rowIndex, colIndex) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      const rowCount = sheet.rows.length
      if (rowCount === 0) return
      e.preventDefault()
      e.stopPropagation()

      const maxC = METER_GRID_COL_COUNT - 1
      let r = rowIndex
      let c = colIndex

      if (e.key === 'ArrowUp') {
        if (r <= 0) return
        r -= 1
      } else if (e.key === 'ArrowDown') {
        if (r >= rowCount - 1) return
        r += 1
      } else if (e.key === 'ArrowLeft') {
        if (c > 0) {
          c -= 1
        } else if (rowIndex > 0) {
          r = rowIndex - 1
          c = maxC
        } else {
          return
        }
      } else if (e.key === 'ArrowRight') {
        if (c < maxC) {
          c += 1
        } else if (rowIndex < rowCount - 1) {
          r = rowIndex + 1
          c = 0
        } else {
          return
        }
      }

      focusMeterCell(r, c)
    },
    [sheet.rows.length, focusMeterCell]
  )

  useEffect(() => {
    setSheet(normalizeSheet(project?.utilitySheet))
  }, [project?.id, project?.version, project?.utilitySheet])

  const totals = useMemo(() => {
    let electricUnits = 0
    let waterUnits = 0
    let amount = 0
    sheet.rows.forEach((row) => {
      const c = computeRow(row, sheet.pricePerKwh, sheet.pricePerWaterUnit)
      electricUnits += c.electricUnits
      waterUnits += c.waterUnits
      amount += c.subtotal
    })
    return { electricUnits, waterUnits, amount }
  }, [sheet])

  const periodOrderInvalid = useMemo(
    () => !isUtilityReadingPeriodOrderValid(sheet.readingPeriodStartIso, sheet.readingPeriodEndIso),
    [sheet.readingPeriodStartIso, sheet.readingPeriodEndIso]
  )

  const prevDateMax = useMemo(() => {
    const end = sanitizeOptionalIsoYmd(sheet.readingPeriodEndIso)
    return end ? addCalendarDaysIsoYmd(end, -1) : undefined
  }, [sheet.readingPeriodEndIso])

  const currDateMin = useMemo(() => {
    const start = sanitizeOptionalIsoYmd(sheet.readingPeriodStartIso)
    return start ? addCalendarDaysIsoYmd(start, 1) : undefined
  }, [sheet.readingPeriodStartIso])

  const updatePrice = (field, value) => {
    const n = value === '' ? 0 : Number(value)
    setSheet((prev) => ({ ...prev, [field]: Number.isFinite(n) ? n : 0 }))
  }

  const updateMeta = (field, value) => {
    setSheet((prev) => ({ ...prev, [field]: value }))
  }

  const updateRow = useCallback((rowId, patch) => {
    setSheet((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r))
    }))
  }, [])

  const addRow = () => {
    setSheet((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        {
          id: newRowId(),
          roomNumber: '',
          lastMonthElectric: 0,
          currentMonthElectric: 0,
          lastMonthWater: 0,
          currentMonthWater: 0
        }
      ]
    }))
  }

  const removeRow = (rowId) => {
    setSheet((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== rowId)
    }))
  }

  const handleSave = async () => {
    setError('')
    if (periodOrderInvalid) {
      setError('Current reading date must be after the previous reading date.')
      return
    }
    setSaving(true)
    try {
      await api.updateUtilitySheet(project.id, sheet)
      if (onSaved) await onSaved()
      alert('Saved.')
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const openExportPicker = () => {
    setError('')
    if (periodOrderInvalid) {
      setError('Fix billing period before exporting: current reading date must be after the previous reading date.')
      return
    }
    if (sheet.rows.length === 0) {
      setError('Add at least one row before exporting.')
      return
    }
    setExportPickerNotice('')
    setExportRowSelected(Object.fromEntries(sheet.rows.map((r) => [r.id, true])))
    setExportPickerOpen(true)
  }

  const closeExportPicker = () => {
    setExportPickerOpen(false)
    setExportPickerNotice('')
  }

  const toggleExportRow = (rowId) => {
    setExportPickerNotice('')
    setExportRowSelected((prev) => ({ ...prev, [rowId]: !prev[rowId] }))
  }

  const setAllExportRows = (value) => {
    setExportPickerNotice('')
    setExportRowSelected(Object.fromEntries(sheet.rows.map((r) => [r.id, value])))
  }

  const handleConfirmExport = async () => {
    const picked = sheet.rows.filter((r) => exportRowSelected[r.id])
    if (picked.length === 0) {
      setExportPickerNotice('Select at least one row to export.')
      return
    }
    if (!isUtilityReadingPeriodOrderValid(sheet.readingPeriodStartIso, sheet.readingPeriodEndIso)) {
      setExportPickerNotice('Fix billing period: current reading date must be after the previous reading date.')
      return
    }
    setExportPickerOpen(false)
    setExporting(true)
    setError('')
    try {
      const { exportUtilityBillToImage } = await import('../utils/exportToImage')
      const sheetForExport = { ...sheet, rows: picked }
      await exportUtilityBillToImage(sheetForExport, project.name)
    } catch (e) {
      setError(e.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  /** For a new billing month: last month ← current, clear current; also roll Billing period. */
  const handleCarryCurrentToLastMonth = () => {
    if (sheet.rows.length === 0) return
    const ok = window.confirm(
      'For every row, copy Current electric / Current water into Last month electric / Last month water, then clear the current fields. Also move Billing period Current reading → Previous reading, and set Current reading to today. Continue?'
    )
    if (!ok) return
    const todayIso = todayLocalIsoYmd()
    setSheet((prev) => ({
      ...prev,
      readingPeriodStartIso: sanitizeOptionalIsoYmd(prev.readingPeriodEndIso),
      readingPeriodEndIso: todayIso,
      rows: prev.rows.map((r) => {
        const ce = Number(r.currentMonthElectric) || 0
        const cw = Number(r.currentMonthWater) || 0
        return {
          ...r,
          lastMonthElectric: ce,
          lastMonthWater: cw,
          currentMonthElectric: 0,
          currentMonthWater: 0
        }
      })
    }))
  }

  const inputCls =
    'w-full min-w-0 px-2 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100'
  const headerInputCls =
    'w-full min-w-[140px] max-w-[220px] px-2 py-1.5 rounded-md text-sm text-gray-900 border border-white/40 bg-white/95 focus:outline-none focus:ring-2 focus:ring-white'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center gap-2"
        >
          <span>←</span>
          <span>Back to projects</span>
        </button>
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
          {project.description ? (
            <p className="text-sm text-gray-600 mt-1">{project.description}</p>
          ) : null}
          <p className="text-xs text-gray-500 mt-1">Utility bill · Admin · Last / current meter readings</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
          <h3 className="text-lg font-semibold">Shared rates (whole sheet)</h3>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price per kWh (THB)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={sheet.pricePerKwh === 0 ? '' : sheet.pricePerKwh}
              onChange={(e) => updatePrice('pricePerKwh', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price per water unit (THB)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={sheet.pricePerWaterUnit === 0 ? '' : sheet.pricePerWaterUnit}
              onChange={(e) => updatePrice('pricePerWaterUnit', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <h3 className="text-lg font-semibold shrink-0">Meter readings</h3>
            <div className="flex flex-wrap items-end gap-4 lg:justify-end">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-xs font-medium text-blue-100">Billing period</span>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-0.5 min-w-[140px]">
                    <label htmlFor="ub-period-start" className="text-[10px] font-medium text-blue-200/90">
                      Previous reading
                    </label>
                    <input
                      id="ub-period-start"
                      type="date"
                      className={headerInputCls}
                      value={sheet.readingPeriodStartIso || ''}
                      max={prevDateMax || ''}
                      onChange={(e) => updateMeta('readingPeriodStartIso', e.target.value)}
                    />
                  </div>
                  <span className="hidden sm:inline pb-2 text-sm text-blue-100/90" aria-hidden="true">
                    →
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-[140px]">
                    <label htmlFor="ub-period-end" className="text-[10px] font-medium text-blue-200/90">
                      Current reading
                    </label>
                    <input
                      id="ub-period-end"
                      type="date"
                      className={headerInputCls}
                      min={currDateMin || ''}
                      value={sheet.readingPeriodEndIso || ''}
                      onChange={(e) => updateMeta('readingPeriodEndIso', e.target.value)}
                    />
                  </div>
                </div>
                {periodOrderInvalid ? (
                  <p className="text-xs text-red-200 max-w-[min(100%,22rem)]">
                    Current reading date must be after the previous reading date.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={addRow}
                className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium whitespace-nowrap"
              >
                + Add row
              </button>
            </div>
          </div>
        </div>

        <table ref={meterTableRootRef} className="min-w-[960px] w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium text-gray-700">Unit</th>
              <th className="text-left p-3 font-medium text-gray-700">Last month electric</th>
              <th className="text-left p-3 font-medium text-gray-700">Current electric</th>
              <th className="text-left p-3 font-medium text-gray-700">kWh used</th>
              <th className="text-left p-3 font-medium text-gray-700">Last month water</th>
              <th className="text-left p-3 font-medium text-gray-700">Current water</th>
              <th className="text-left p-3 font-medium text-gray-700">Water units</th>
              <th className="text-left p-3 font-medium text-gray-700">Subtotal (THB)</th>
              <th className="p-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {sheet.rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  No rows yet. Click &quot;Add row&quot; to start.
                </td>
              </tr>
            ) : (
              sheet.rows.map((row, rowIndex) => {
                const { electricUnits, waterUnits, subtotal } = computeRow(
                  row,
                  sheet.pricePerKwh,
                  sheet.pricePerWaterUnit
                )
                return (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="p-2">
                      <input
                        data-ub-meter={`${rowIndex}-0`}
                        className={inputCls}
                        value={row.roomNumber ?? ''}
                        onChange={(e) => updateRow(row.id, { roomNumber: e.target.value })}
                        onKeyDown={(e) => handleMeterCellKeyDown(e, rowIndex, 0)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        data-ub-meter={`${rowIndex}-1`}
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputCls}
                        value={row.lastMonthElectric === 0 ? '' : row.lastMonthElectric}
                        onChange={(e) =>
                          updateRow(row.id, {
                            lastMonthElectric: e.target.value === '' ? 0 : Number(e.target.value)
                          })
                        }
                        onKeyDown={(e) => handleMeterCellKeyDown(e, rowIndex, 1)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        data-ub-meter={`${rowIndex}-2`}
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputCls}
                        value={row.currentMonthElectric === 0 ? '' : row.currentMonthElectric}
                        onChange={(e) =>
                          updateRow(row.id, {
                            currentMonthElectric: e.target.value === '' ? 0 : Number(e.target.value)
                          })
                        }
                        onKeyDown={(e) => handleMeterCellKeyDown(e, rowIndex, 2)}
                      />
                    </td>
                    <td className="p-2 text-gray-800 font-medium">{electricUnits.toFixed(2)}</td>
                    <td className="p-2">
                      <input
                        data-ub-meter={`${rowIndex}-3`}
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputCls}
                        value={row.lastMonthWater === 0 ? '' : row.lastMonthWater}
                        onChange={(e) =>
                          updateRow(row.id, {
                            lastMonthWater: e.target.value === '' ? 0 : Number(e.target.value)
                          })
                        }
                        onKeyDown={(e) => handleMeterCellKeyDown(e, rowIndex, 3)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        data-ub-meter={`${rowIndex}-4`}
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputCls}
                        value={row.currentMonthWater === 0 ? '' : row.currentMonthWater}
                        onChange={(e) =>
                          updateRow(row.id, {
                            currentMonthWater: e.target.value === '' ? 0 : Number(e.target.value)
                          })
                        }
                        onKeyDown={(e) => handleMeterCellKeyDown(e, rowIndex, 4)}
                      />
                    </td>
                    <td className="p-2 text-gray-800 font-medium">{waterUnits.toFixed(2)}</td>
                    <td className="p-2 text-gray-800 font-medium">{subtotal.toFixed(2)}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-red-600 hover:text-red-800 text-xs px-2 py-1"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {sheet.rows.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
              <tr>
                <td className="p-3 text-gray-800" colSpan={3}>
                  Total
                </td>
                <td className="p-3 text-blue-700">{totals.electricUnits.toFixed(2)} kWh</td>
                <td className="p-3" colSpan={2} />
                <td className="p-3 text-blue-700">{totals.waterUnits.toFixed(2)} units</td>
                <td className="p-3 text-green-700">THB {totals.amount.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {error ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
      ) : null}

      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || periodOrderInvalid}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save to server'}
        </button>
        <button
          type="button"
          onClick={handleCarryCurrentToLastMonth}
          disabled={sheet.rows.length === 0}
          title="Copies current meter readings into last month and clears current for each row; also rolls Billing period (Current → Previous, Current = today)."
          className="px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium disabled:opacity-50"
        >
          Copy current → last
        </button>
        <button
          type="button"
          onClick={openExportPicker}
          disabled={exporting || periodOrderInvalid}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 flex items-center gap-2"
        >
          <span>📊</span>
          <span>{exporting ? 'Exporting…' : 'Export'}</span>
        </button>
      </div>

      {exportPickerOpen ? (
        <div
          className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={closeExportPicker}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-12 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="export-picker-title"
          >
            <div className="flex items-center justify-between p-6 border-b">
              <h3 id="export-picker-title" className="text-xl font-semibold text-gray-900">
                Rows to export
              </h3>
              <button
                type="button"
                onClick={closeExportPicker}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded p-2 transition-colors"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>
            <p className="px-6 pt-2 text-sm text-gray-600">
              Only checked rows appear in the PNG. Shared rates and billing period (previous → current reading
              dates) apply.
            </p>
            {exportPickerNotice ? (
              <p className="px-6 pt-2 text-sm text-red-600">{exportPickerNotice}</p>
            ) : null}
            <div className="px-6 py-3 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setAllExportRows(true)}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setAllExportRows(false)}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                Clear all
              </button>
            </div>
            <ul className="px-6 pb-4 max-h-[min(50vh,320px)] overflow-y-auto space-y-2 border-b border-gray-100">
              {sheet.rows.map((row, idx) => {
                const label = (row.roomNumber && String(row.roomNumber).trim()) || `Row ${idx + 1} (no unit)`
                return (
                  <li key={row.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <input
                      id={`export-row-${row.id}`}
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      checked={!!exportRowSelected[row.id]}
                      onChange={() => toggleExportRow(row.id)}
                    />
                    <label htmlFor={`export-row-${row.id}`} className="flex-1 text-sm text-gray-800 cursor-pointer">
                      {label}
                    </label>
                  </li>
                )
              })}
            </ul>
            <div className="p-6 flex gap-3">
              <button
                type="button"
                onClick={closeExportPicker}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExport}
                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
              >
                Export PNG
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
