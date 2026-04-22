import { useState, useEffect, useMemo, useCallback } from 'react'
import * as api from '../utils/apiClient'

function emptySheet() {
  return {
    pricePerKwh: 0,
    pricePerWaterUnit: 0,
    readingMonthText: '',
    readingDateText: '',
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

/**
 * Utility bill page (English UI only).
 */
export default function UtilityBillPage({ project, onBack, onSaved }) {
  const [sheet, setSheet] = useState(() => normalizeSheet(project?.utilitySheet))
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

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

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      const { exportUtilityBillToImage } = await import('../utils/exportToImage')
      await exportUtilityBillToImage(sheet, project.name)
    } catch (e) {
      setError(e.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  /** For a new billing month: last month ← current, then clear current (per row). */
  const handleCarryCurrentToLastMonth = () => {
    if (sheet.rows.length === 0) return
    const ok = window.confirm(
      'For every row, copy Current electric / Current water into Last month electric / Last month water, then clear the current fields so you can enter the new readings. Continue?'
    )
    if (!ok) return
    setSheet((prev) => ({
      ...prev,
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
              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-blue-100 mb-1">
                  Billing month (this reading)
                </label>
                <input
                  type="text"
                  className={headerInputCls}
                  placeholder="e.g. April 2026"
                  value={sheet.readingMonthText}
                  onChange={(e) => updateMeta('readingMonthText', e.target.value)}
                />
              </div>
              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-blue-100 mb-1">Reading date</label>
                <input
                  type="text"
                  className={headerInputCls}
                  placeholder="e.g. 2026-04-22"
                  value={sheet.readingDateText}
                  onChange={(e) => updateMeta('readingDateText', e.target.value)}
                />
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

        <table className="min-w-[960px] w-full text-sm">
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
              sheet.rows.map((row) => {
                const { electricUnits, waterUnits, subtotal } = computeRow(
                  row,
                  sheet.pricePerKwh,
                  sheet.pricePerWaterUnit
                )
                return (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="p-2">
                      <input
                        className={inputCls}
                        value={row.roomNumber ?? ''}
                        onChange={(e) => updateRow(row.id, { roomNumber: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <input
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
                      />
                    </td>
                    <td className="p-2">
                      <input
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
                      />
                    </td>
                    <td className="p-2 text-gray-800 font-medium">{electricUnits.toFixed(2)}</td>
                    <td className="p-2">
                      <input
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
                      />
                    </td>
                    <td className="p-2">
                      <input
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
                  Totals
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
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save to server'}
        </button>
        <button
          type="button"
          onClick={handleCarryCurrentToLastMonth}
          disabled={sheet.rows.length === 0}
          title="Copies current meter readings into last month and clears current for each row."
          className="px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium disabled:opacity-50"
        >
          Copy current → last
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 flex items-center gap-2"
        >
          <span>📊</span>
          <span>{exporting ? 'Exporting…' : 'Export'}</span>
        </button>
      </div>
    </div>
  )
}
