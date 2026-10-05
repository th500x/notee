/**
 * 登录后：待记（均线 + 周指标）+ 已记操作（按年/月折叠）。同一信号最多一笔。
 */

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ETH_SIGNAL_SOURCE } from '../constants/ethSubscribe'
import { useEthMaTradeLogs } from '../hooks/useEthMaTradeLogs'
import { formatEthPrice, formatHoldDays, formatPnl, formatSignalTime } from '../utils/ethMaFormat'
import { groupTradesByYearMonth, isCurrentYearMonth } from '../utils/ethMaTradeGroups'
import { suggestTradePnl } from '../utils/ethMaTradePnl'

const EMPTY_DRAFT = {
  entryPrice: '',
  quantity: '',
  takeProfitPrice: '',
  stopLossPrice: '',
  closedOn: '',
  pnl: '',
}

function signalKey(signal) {
  if (!signal) return ''
  if (signal.source === ETH_SIGNAL_SOURCE.WEEK) {
    return `week:${signal.weekId}`
  }
  return `ma:${signal.openTime}`
}

function tradeKey(trade) {
  if (!trade) return ''
  if (trade.signalSource === ETH_SIGNAL_SOURCE.WEEK) {
    return `week:${trade.weekId}`
  }
  return `ma:${trade.signalOpenTime}`
}

function signalLine(signal) {
  if (!signal) return ''
  const time =
    signal.source === ETH_SIGNAL_SOURCE.WEEK
      ? signal.weekId
      : formatSignalTime(signal.at || signal.openTime)
  const close = signal.close != null ? `收盘 ${formatEthPrice(signal.close)}` : ''
  const priceLabel =
    signal.source === ETH_SIGNAL_SOURCE.WEEK && signal.close != null
      ? `周均 ${formatEthPrice(signal.close)}`
      : close
  return [signal.kindLabel, signal.biasLabel, time, priceLabel].filter(Boolean).join(' · ')
}

function pnlTone(value) {
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'zero'
}

function formatHoldBySource(avgHoldBySource) {
  const ma = formatHoldDays(avgHoldBySource?.ma)
  const week = formatHoldDays(avgHoldBySource?.week)
  return `平均持仓天数：${ma}（均线）${week}（指标）`
}

function FoldSummary({ label, avgHoldBySource, pnlTotal }) {
  const total = Number.isFinite(Number(pnlTotal)) ? Number(pnlTotal) : 0
  return (
    <summary className="eth-ma-trade-log__fold-head">
      <span className="eth-ma-trade-log__fold-title">
        <span>{label}</span>
        <span className="eth-ma-trade-log__hold">{formatHoldBySource(avgHoldBySource)}</span>
      </span>
      <span className={`eth-ma-trade-log__pnl eth-ma-trade-log__pnl--${pnlTone(total)}`}>
        {formatPnl(total)}
      </span>
    </summary>
  )
}

function draftFromTrade(trade) {
  if (!trade) return { ...EMPTY_DRAFT }
  return {
    entryPrice: trade.entryPrice != null ? String(trade.entryPrice) : '',
    quantity: trade.quantity != null ? String(trade.quantity) : '',
    takeProfitPrice: trade.takeProfitPrice != null ? String(trade.takeProfitPrice) : '',
    stopLossPrice: trade.stopLossPrice != null ? String(trade.stopLossPrice) : '',
    closedOn: trade.closedOn || '',
    pnl: trade.pnl != null ? String(trade.pnl) : '',
  }
}

function TradeForm({ signal, draft, setDraft, busy, error, onSave, onCancel }) {
  const suggestedTp = suggestTradePnl({
    cross: signal?.cross,
    entryPrice: draft.entryPrice,
    exitPrice: draft.takeProfitPrice,
    quantity: draft.quantity,
  })
  const suggestedSl = suggestTradePnl({
    cross: signal?.cross,
    entryPrice: draft.entryPrice,
    exitPrice: draft.stopLossPrice,
    quantity: draft.quantity,
  })

  const setField = (key) => (event) => {
    setDraft((prev) => ({ ...prev, [key]: event.target.value }))
  }

  return (
    <form
      className="eth-ma-trade-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <p className="eth-ma-trade-form__signal">{signalLine(signal)}</p>
      <div className="eth-ma-trade-form__grid">
        <label>
          购买价格
          <input className="eth-ma-subscribe__input" required type="number" step="any" min="0" value={draft.entryPrice} onChange={setField('entryPrice')} />
        </label>
        <label>
          数量
          <input className="eth-ma-subscribe__input" required type="number" step="any" min="0" value={draft.quantity} onChange={setField('quantity')} />
        </label>
        <label>
          止盈价
          <input className="eth-ma-subscribe__input" required type="number" step="any" min="0" value={draft.takeProfitPrice} onChange={setField('takeProfitPrice')} />
        </label>
        <label>
          止损价（可空）
          <input className="eth-ma-subscribe__input" type="number" step="any" min="0" value={draft.stopLossPrice} onChange={setField('stopLossPrice')} />
        </label>
        <label>
          止盈/止损日期
          <input className="eth-ma-subscribe__input" type="date" value={draft.closedOn} onChange={setField('closedOn')} />
        </label>
        <label>
          最终收益（手填）
          <input className="eth-ma-subscribe__input" type="number" step="any" value={draft.pnl} onChange={setField('pnl')} />
        </label>
      </div>
      <p className="eth-ma-trade-form__hint">
        参考：若打止盈 {formatPnl(suggestedTp)}
        {draft.stopLossPrice !== '' ? ` · 若打止损 ${formatPnl(suggestedSl)}` : ''}
        。可点下方填入后再改。
      </p>
      <div className="eth-ma-trade-form__actions">
        <button
          type="button"
          className="eth-ma-subscribe__btn eth-ma-subscribe__btn--ghost"
          disabled={suggestedTp == null}
          onClick={() => setDraft((prev) => ({ ...prev, pnl: String(suggestedTp) }))}
        >
          填入止盈参考
        </button>
        <button
          type="button"
          className="eth-ma-subscribe__btn eth-ma-subscribe__btn--ghost"
          disabled={suggestedSl == null}
          onClick={() => setDraft((prev) => ({ ...prev, pnl: String(suggestedSl) }))}
        >
          填入止损参考
        </button>
        <button type="submit" className="eth-ma-subscribe__btn" disabled={busy}>
          {busy ? '保存中…' : '保存'}
        </button>
        <button type="button" className="eth-ma-subscribe__link" onClick={onCancel}>
          取消
        </button>
      </div>
      {error && <p className="eth-ma-subscribe__error">{error}</p>}
    </form>
  )
}

function EthMaTradeLogPanel({ accountId }) {
  const { recentSignals, trades, loading, busy, error, setError, save, remove } = useEthMaTradeLogs(accountId)
  const [editingKey, setEditingKey] = useState(null)
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT })

  const tradesByKey = useMemo(() => {
    const map = new Map()
    for (const trade of trades) {
      map.set(tradeKey(trade), trade)
    }
    return map
  }, [trades])

  const pendingSignals = useMemo(
    () => recentSignals.filter((item) => !item.hasTrade),
    [recentSignals]
  )
  const grouped = useMemo(() => groupTradesByYearMonth(trades), [trades])

  const editingSignal = useMemo(() => {
    if (!editingKey) return null
    return (
      recentSignals.find((item) => signalKey(item) === editingKey) ||
      tradesByKey.get(editingKey)?.signal ||
      null
    )
  }, [editingKey, recentSignals, tradesByKey])

  const openCreate = (signal) => {
    setError('')
    const key = signalKey(signal)
    setEditingKey(key)
    const existing = tradesByKey.get(key)
    if (existing) {
      setDraft(draftFromTrade(existing))
      return
    }
    setDraft({
      ...EMPTY_DRAFT,
      entryPrice: signal.close != null ? String(signal.close) : '',
    })
  }

  const openEdit = (trade) => {
    setError('')
    setEditingKey(tradeKey(trade))
    setDraft(draftFromTrade(trade))
  }

  const closeForm = () => {
    setEditingKey(null)
    setDraft({ ...EMPTY_DRAFT })
  }

  const formOpen = editingKey != null && editingSignal != null

  useEffect(() => {
    if (!formOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') closeForm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [formOpen, editingKey])

  const handleSave = async () => {
    if (!editingSignal) return
    const body =
      editingSignal.source === ETH_SIGNAL_SOURCE.WEEK
        ? {
            signalSource: ETH_SIGNAL_SOURCE.WEEK,
            weekId: editingSignal.weekId,
            entryPrice: draft.entryPrice,
            quantity: draft.quantity,
            takeProfitPrice: draft.takeProfitPrice,
            stopLossPrice: draft.stopLossPrice === '' ? null : draft.stopLossPrice,
            closedOn: draft.closedOn === '' ? null : draft.closedOn,
            pnl: draft.pnl === '' ? null : draft.pnl,
          }
        : {
            signalSource: ETH_SIGNAL_SOURCE.MA,
            signalOpenTime: editingSignal.openTime,
            entryPrice: draft.entryPrice,
            quantity: draft.quantity,
            takeProfitPrice: draft.takeProfitPrice,
            stopLossPrice: draft.stopLossPrice === '' ? null : draft.stopLossPrice,
            closedOn: draft.closedOn === '' ? null : draft.closedOn,
            pnl: draft.pnl === '' ? null : draft.pnl,
          }
    const ok = await save(body)
    if (ok) closeForm()
  }

  const handleDelete = async (trade) => {
    if (!window.confirm('删除这笔操作记录？信号本身仍会留在待记列表。')) return
    const source = trade.signalSource || ETH_SIGNAL_SOURCE.MA
    const ref = source === ETH_SIGNAL_SOURCE.WEEK ? trade.weekId : trade.signalOpenTime
    const ok = await remove(ref, source)
    if (ok && editingKey === tradeKey(trade)) closeForm()
  }

  /** 已记行：手填收益恰好 0 → 灰底；否则随金叉/死叉。待记只看信号方向。 */
  const rowTone = (signal, trade) => {
    if (trade && trade.pnl != null && Number(trade.pnl) === 0) return 'flat'
    if (!signal) return 'neutral'
    if (signal.cross === 'golden' || signal.bias === 'long') return 'golden'
    if (signal.cross === 'death' || signal.bias === 'short') return 'death'
    return 'neutral'
  }

  const signalTone = (signal) => rowTone(signal, null)

  return (
    <div className="eth-ma-trade-log">
      <h3 className="eth-ma-subscribe__title">操作记录</h3>
      <p className="eth-ma-subscribe__hint">
        只有点「记一笔」才写入。均线交叉与周指标各算一条。最终收益以你填的为准。
      </p>
      <div className="eth-ma-trade-log__scroll">
        {loading ? (
          <p className="eth-ma-subscribe__muted">加载操作记录…</p>
        ) : (
          <>
            {editingKey == null && error && (
              <p className="eth-ma-subscribe__error">{error}</p>
            )}

            <h4 className="eth-ma-trade-log__section">待记</h4>
            {pendingSignals.length === 0 ? (
              <p className="eth-ma-subscribe__muted">暂无待记信号。新的金叉/死叉或周指标出现后会列在这里。</p>
            ) : (
              <ul className="eth-ma-trade-log__list">
                {pendingSignals.map((signal) => (
                  <li key={signalKey(signal)} className={`eth-ma-trade-log__row eth-ma-trade-log__row--${signalTone(signal)}`}>
                    <span>{signalLine(signal)}</span>
                    <button
                      type="button"
                      className="eth-ma-subscribe__btn"
                      disabled={busy}
                      onClick={() => openCreate(signal)}
                    >
                      记一笔
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h4 className="eth-ma-trade-log__section">已记</h4>
            {grouped.length === 0 ? (
              <p className="eth-ma-subscribe__muted">还没有记过。未操作的信号不会出现在这里。</p>
            ) : (
              grouped.map((yearGroup) => (
                <details key={yearGroup.year} className="eth-ma-trade-log__fold" open={yearGroup.year === new Date().getFullYear()}>
                  <FoldSummary
                    label={`${yearGroup.year}年`}
                    avgHoldBySource={yearGroup.avgHoldBySource}
                    pnlTotal={yearGroup.pnlTotal}
                  />
                  {yearGroup.months.map((monthGroup) => (
                    <details
                      key={`${monthGroup.year}-${monthGroup.month}`}
                      className="eth-ma-trade-log__fold eth-ma-trade-log__fold--month"
                      open={isCurrentYearMonth(monthGroup.year, monthGroup.month)}
                    >
                      <FoldSummary
                        label={`${monthGroup.month}月 · ${monthGroup.trades.length} 笔`}
                        avgHoldBySource={monthGroup.avgHoldBySource}
                        pnlTotal={monthGroup.pnlTotal}
                      />
                      <ul className="eth-ma-trade-log__list">
                        {monthGroup.trades.map((trade) => {
                          const tone = rowTone(trade.signal, trade)
                          const pnlUnfilled = trade.pnl == null
                          const editClass = [
                            'eth-ma-subscribe__btn',
                            'eth-ma-subscribe__btn--ghost',
                            pnlUnfilled && tone !== 'flat' && tone !== 'neutral'
                              ? `eth-ma-trade-log__edit--unfilled eth-ma-trade-log__edit--${tone}`
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')
                          return (
                          <li key={trade.id} className={`eth-ma-trade-log__row eth-ma-trade-log__row--${tone}`}>
                            <span>
                              {signalLine(trade.signal)}
                              {` · 买 ${formatEthPrice(trade.entryPrice)} × ${trade.quantity}`}
                              {trade.pnl != null ? ` · 收益 ${formatPnl(trade.pnl)}` : ''}
                            </span>
                            <span className="eth-ma-trade-log__row-actions">
                              <button type="button" className={editClass} disabled={busy} onClick={() => openEdit(trade)}>
                                改
                              </button>
                              <button type="button" className="eth-ma-subscribe__link" disabled={busy} onClick={() => handleDelete(trade)}>
                                删除
                              </button>
                            </span>
                          </li>
                          )
                        })}
                      </ul>
                    </details>
                  ))}
                </details>
              ))
            )}
          </>
        )}
      </div>
      {formOpen &&
        createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="编辑操作记录">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto p-4">
              <h4 className="text-base font-semibold text-gray-900 mb-2">
                {tradesByKey.has(editingKey) ? '修改这笔记录' : '记一笔'}
              </h4>
              <TradeForm
                signal={editingSignal}
                draft={draft}
                setDraft={setDraft}
                busy={busy}
                error={error}
                onSave={handleSave}
                onCancel={closeForm}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default EthMaTradeLogPanel
