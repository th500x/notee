/**
 * 日历右侧：按登录账号保存一个钱包地址，并显示月均。
 * 日记录由服务器自动写入。
 */

import { useEffect, useState } from 'react'
import { clearWalletWatch, fetchWalletWatch, saveWalletWatch } from '../services/lifeResumeClient'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const VISIBLE_MONTHS = 6

const CHAIN_LABEL = {
  ETHEREUM: '以太坊',
  ARBITRUM: 'Arbitrum',
  OPTIMISM: 'Optimism',
  POLYGON: 'Polygon',
  BASE: 'Base',
  BNB: 'BNB',
}

function formatUsd(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '--'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatStart(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!match) return iso || ''
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`
}

function formatMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''))
  if (!match) return month || ''
  return `${match[1]}/${Number(match[2])}`
}

function WalletAssetsPanel({ auth }) {
  const [address, setAddress] = useState('')
  const [watch, setWatch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showOlder, setShowOlder] = useState(false)

  const applyView = (data) => {
    setWatch(data)
    setAddress(data?.address || '')
    setError(data?.quoteError || '')
  }

  useEffect(() => {
    if (!auth?.accountId) {
      setWatch(null)
      setAddress('')
      setError('')
      return undefined
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const result = await fetchWalletWatch()
      if (cancelled) return
      setLoading(false)
      if (!result.success) {
        setError(result.error || '暂时读不到已保存的地址')
        return
      }
      applyView(result.data)
    })()
    return () => {
      cancelled = true
    }
  }, [auth?.accountId])

  const save = async (event) => {
    event.preventDefault()
    const next = address.trim()
    if (!ADDRESS_RE.test(next)) {
      setError('请填写完整的以太坊地址（0x 开头、共 42 位）')
      return
    }
    setLoading(true)
    setError('')
    const result = await saveWalletWatch(next)
    setLoading(false)
    if (!result.success) {
      setError(result.error || '没有保存成功')
      return
    }
    applyView(result.data)
  }

  const clear = async () => {
    if (!window.confirm('清除这个账号上的钱包地址？已记下的月均会停更，以前的日子仍留在库里。')) return
    setLoading(true)
    const result = await clearWalletWatch()
    setLoading(false)
    if (!result.success) {
      setError(result.error || '没有清除成功')
      return
    }
    applyView(result.data)
    setShowOlder(false)
  }

  const months = watch?.months || []
  const olderMonths = months.length > VISIBLE_MONTHS ? months.slice(0, -VISIBLE_MONTHS) : []
  const recentMonths = months.length > VISIBLE_MONTHS ? months.slice(-VISIBLE_MONTHS) : months
  const quote = watch?.quote

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-8">
      <h3 className="text-lg font-semibold text-gray-900">钱包资产</h3>
      {!auth?.accountId ? (
        <p className="text-sm text-gray-500 mt-2">登录后才能保存钱包地址。地址跟账号走，和订阅 ETH 一样。请在页面下方登录。</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            每个账号保存一个地址。从保存后的下个月 1 日起，服务器每天自动记一次合计，不用每天打开页面。月均按当月有记录的天数平均，没记上的日子不补 0。
          </p>
          <form className="flex flex-col sm:flex-row gap-2" onSubmit={save}>
            <input
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="0x 开头的钱包地址"
              spellCheck={false}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? '保存中…' : '保存'}
            </button>
          </form>
          {watch?.address && (
            <p className="text-xs text-gray-500 mt-2">
              已保存在账号 {auth.accountId}。月均从 {formatStart(watch.trackingStartsOn)} 起算。
              <button type="button" className="ml-2 text-blue-700 underline" disabled={loading} onClick={clear}>
                清除
              </button>
            </p>
          )}
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          {quote && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-500">当前合计</span>
                <span className="text-2xl font-semibold text-gray-900">{formatUsd(quote.totalUsd)}</span>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600">钱包中的币</dt>
                  <dd>{formatUsd(quote.walletUsd)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600">Uniswap 头寸</dt>
                  <dd>{formatUsd(quote.positionUsd)}</dd>
                </div>
                {quote.feesUsd > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-600">未领手续费</dt>
                    <dd>{formatUsd(quote.feesUsd)}</dd>
                  </div>
                )}
                {quote.rewardsUsd > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-600">未领奖励</dt>
                    <dd>{formatUsd(quote.rewardsUsd)}</dd>
                  </div>
                )}
              </dl>
              {quote.tokens?.length > 0 && (
                <>
                  <h4 className="text-sm font-medium text-gray-900 mt-4">钱包里的币</h4>
                  <ul className="mt-1 text-sm text-gray-700 space-y-1">
                    {quote.tokens.map((token) => (
                      <li key={`${token.chain}-${token.symbol}`} className="flex justify-between gap-3">
                        <span>
                          {token.symbol}
                          {CHAIN_LABEL[token.chain] ? <span className="text-gray-400"> · {CHAIN_LABEL[token.chain]}</span> : null}
                        </span>
                        <span>{formatUsd(token.usd)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {quote.positions?.length > 0 && (
                <>
                  <h4 className="text-sm font-medium text-gray-900 mt-4">Uniswap 头寸</h4>
                  <ul className="mt-1 text-sm text-gray-700 space-y-1">
                    {quote.positions.map((position, index) => (
                      <li key={`${position.chainId}-${position.version}-${index}`} className="flex justify-between gap-3">
                        <span>
                          {position.token0} / {position.token1}
                          <span className="text-gray-400">
                            {' '}
                            · {String(position.version || '').toLowerCase()}
                            {position.inRange === false ? ' · 范围外' : ''}
                          </span>
                        </span>
                        <span>{position.usd == null ? '--' : formatUsd(position.usd)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="text-xs text-gray-400 mt-3">
                <a className="underline" href={`https://etherscan.io/address/${quote.address}`} target="_blank" rel="noreferrer">
                  在 Etherscan 打开这个地址
                </a>
              </p>
            </div>
          )}
          {watch?.address && (
            <div className="mt-5">
              <h4 className="text-sm font-medium text-gray-900 mb-2">月均价值</h4>
              {months.length === 0 ? (
                <p className="text-sm text-gray-500">从 {formatStart(watch.trackingStartsOn)} 起才会有记录，现在还没有月均。</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="p-2 text-left border border-gray-700 font-medium">月份</th>
                      <th className="p-2 text-right border border-gray-700 font-medium">月均</th>
                      <th className="p-2 text-right border border-gray-700 font-medium">天数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {olderMonths.length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan={3} className="p-2 border border-gray-100 text-center">
                          <button type="button" className="text-blue-700 text-sm" onClick={() => setShowOlder((open) => !open)}>
                            {showOlder
                              ? `▲ 折叠 ${olderMonths.length} 个月前的月均`
                              : `▼ 展开 ${olderMonths.length} 个月前的月均（早于 ${formatMonth(recentMonths[0].month)}）`}
                          </button>
                        </td>
                      </tr>
                    )}
                    {showOlder && olderMonths.map((row) => (
                      <tr key={row.month}>
                        <td className="p-2 border border-gray-100">{formatMonth(row.month)}</td>
                        <td className="p-2 border border-gray-100 text-right tabular-nums">{formatUsd(row.averageUsd)}</td>
                        <td className="p-2 border border-gray-100 text-right tabular-nums">{row.days} 天</td>
                      </tr>
                    ))}
                    {recentMonths.map((row) => (
                      <tr key={row.month}>
                        <td className="p-2 border border-gray-100">{formatMonth(row.month)}</td>
                        <td className="p-2 border border-gray-100 text-right tabular-nums">{formatUsd(row.averageUsd)}</td>
                        <td className="p-2 border border-gray-100 text-right tabular-nums">{row.days} 天</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default WalletAssetsPanel
