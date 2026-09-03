/**
 * 登录后：待记交叉 + 已记操作（按年/月折叠）。同一信号最多一笔。
 */

import { useMemo, useState } from 'react'
import { useEthMaTradeLogs } from '../hooks/useEthMaTradeLogs'
import { formatEthPrice, formatPnl, formatSignalTime } from '../utils/ethMaFormat'
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

function signalLine(signal) {
  if (!signal) return ''
  const time = formatSignalTime(signal.at || signal.openTime)
  const close = signal.close != null ? `收盘 ${formatEthPrice(signal.close)}` : ''
  return [signal.kindLabel, signal.biasLabel, time, close].filter(Boolean).join(' · ')
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
  const [editingOpenTime, setEditingOpenTime] = useState(null)
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT })

  const tradesByOpenTime = useMemo(() => {
    const map = new Map()
    for (const trade of trades) {
      map.set(Number(trade.signalOpenTime), trade)
    }
    return map
  }, [trades])

  const pendingSignals = useMemo(
    () => recentSignals.filter((item) => !item.hasTrade),
    [recentSignals]
  )
  const grouped = useMemo(() => groupTradesByYearMonth(trades), [trades])
  const editingSignal =
    recentSignals.find((item) => item.openTime === editingOpenTime) ||
    tradesByOpenTime.get(editingOpenTime)?.signal ||
    null

  const openCreate = (signal) => {
    setError('')
    setEditingOpenTime(signal.openTime)
    const existing = tradesByOpenTime.get(signal.openTime)
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
    setEditingOpenTime(trade.signalOpenTime)
    setDraft(draftFromTrade(trade))
  }

  const closeForm = () => {
    setEditingOpenTime(null)
    setDraft({ ...EMPTY_DRAFT })
  }

  const handleSave = async () => {
    if (editingOpenTime == null) return
    const ok = await save({
      signalOpenTime: editingOpenTime,
      entryPrice: draft.entryPrice,
      quantity: draft.quantity,
      takeProfitPrice: draft.takeProfitPrice,
      stopLossPrice: draft.stopLossPrice === '' ? null : draft.stopLossPrice,
      closedOn: draft.closedOn === '' ? null : draft.closedOn,
      pnl: draft.pnl === '' ? null : draft.pnl,
    })
    if (ok) closeForm()
  }

  const handleDelete = async (signalOpenTime) => {
    if (!window.confirm('删除这笔操作记录？信号本身仍会留在待记列表。')) return
    const ok = await remove(signalOpenTime)
    if (ok && editingOpenTime === signalOpenTime) closeForm()
  }

  return (
    <div className="eth-ma-trade-log">
      <h3 className="eth-ma-subscribe__title">操作记录</h3>
      <p className="eth-ma-subscribe__hint">
        只有点「记一笔」才写入。同一根交叉加仓或改止盈，都改这一笔。最终收益以你填的为准。
      </p>
      <div className="eth-ma-trade-log__scroll">
        {loading ? (
          <p className="eth-ma-subscribe__muted">加载操作记录…</p>
        ) : (
          <>
            {editingOpenTime != null && editingSignal && (
              <TradeForm
                signal={editingSignal}
                draft={draft}
                setDraft={setDraft}
                busy={busy}
                error={error}
                onSave={handleSave}
                onCancel={closeForm}
              />
            )}
            {editingOpenTime == null && error && (
              <p className="eth-ma-subscribe__error">{error}</p>
            )}

            <h4 className="eth-ma-trade-log__section">待记</h4>
            {pendingSignals.length === 0 ? (
              <p className="eth-ma-subscribe__muted">暂无待记信号。新的金叉/死叉出现后会列在这里。</p>
            ) : (
              <ul className="eth-ma-trade-log__list">
                {pendingSignals.map((signal) => (
                  <li key={signal.openTime} className={`eth-ma-trade-log__row eth-ma-trade-log__row--${signal.cross}`}>
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
              <p className="eth-ma-subscribe__muted">还没有记过。未操作的交叉不会出现在这里。</p>
            ) : (
              grouped.map((yearGroup) => (
                <details key={yearGroup.year} className="eth-ma-trade-log__fold" open={yearGroup.year === new Date().getFullYear()}>
                  <summary>{yearGroup.year}年</summary>
                  {yearGroup.months.map((monthGroup) => (
                    <details
                      key={`${monthGroup.year}-${monthGroup.month}`}
                      className="eth-ma-trade-log__fold eth-ma-trade-log__fold--month"
                      open={isCurrentYearMonth(monthGroup.year, monthGroup.month)}
                    >
                      <summary>{monthGroup.month}月 · {monthGroup.trades.length} 笔</summary>
                      <ul className="eth-ma-trade-log__list">
                        {monthGroup.trades.map((trade) => (
                          <li key={trade.id} className={`eth-ma-trade-log__row eth-ma-trade-log__row--${trade.signal?.cross}`}>
                            <span>
                              {signalLine(trade.signal)}
                              {` · 买 ${formatEthPrice(trade.entryPrice)} × ${trade.quantity}`}
                              {trade.pnl != null ? ` · 收益 ${formatPnl(trade.pnl)}` : ''}
                            </span>
                            <span className="eth-ma-trade-log__row-actions">
                              <button type="button" className="eth-ma-subscribe__btn eth-ma-subscribe__btn--ghost" disabled={busy} onClick={() => openEdit(trade)}>
                                改
                              </button>
                              <button type="button" className="eth-ma-subscribe__link" disabled={busy} onClick={() => handleDelete(trade.signalOpenTime)}>
                                删除
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </details>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default EthMaTradeLogPanel
