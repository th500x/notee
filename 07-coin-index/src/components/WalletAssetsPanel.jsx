/**
 * 日历右侧空白处：用户自填地址，展示钱包币值 + Uniswap 头寸。
 * 地址只存在这台浏览器里，不上传账号。
 */

import { useEffect, useState } from 'react'
import { fetchWalletAssets } from '../services/lifeResumeClient'

const STORAGE_KEY = 'notee.07.walletAddress'
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

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

function readStoredAddress() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function writeStoredAddress(address) {
  try {
    window.localStorage.setItem(STORAGE_KEY, address)
  } catch {
    /* 隐私模式写不进去时，这次查询仍然继续 */
  }
}

function WalletAssetsPanel() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [snapshot, setSnapshot] = useState(null)

  const lookup = async (raw) => {
    const next = String(raw || '').trim()
    if (!ADDRESS_RE.test(next)) {
      setError('请填写完整的以太坊地址（0x 开头、共 42 位）')
      setSnapshot(null)
      return
    }
    setLoading(true)
    setError('')
    writeStoredAddress(next)
    const result = await fetchWalletAssets(next)
    setLoading(false)
    if (!result.success) {
      setError(result.error || '暂时取不到资产数据')
      setSnapshot(null)
      return
    }
    setSnapshot(result.data)
  }

  useEffect(() => {
    const stored = readStoredAddress()
    if (!stored) return
    setAddress(stored)
    lookup(stored)
    // 只在打开页面时查一次已保存的地址
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-8">
      <h3 className="text-lg font-semibold text-gray-900">钱包资产</h3>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        填写地址后，把钱包里有价格的币，和 Uniswap 上还开着的头寸加在一起。地址只留在这台浏览器。
      </p>
      <form
        className="flex flex-col sm:flex-row gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          lookup(address)
        }}
      >
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
          {loading ? '查询中…' : '查询'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {snapshot && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-3">
            <span className="text-sm text-gray-500">合计</span>
            <span className="text-2xl font-semibold text-gray-900">{formatUsd(snapshot.totalUsd)}</span>
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">钱包中的币</dt>
              <dd>{formatUsd(snapshot.walletUsd)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">Uniswap 头寸</dt>
              <dd>{formatUsd(snapshot.positionUsd)}</dd>
            </div>
            {snapshot.feesUsd > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">未领手续费</dt>
                <dd>{formatUsd(snapshot.feesUsd)}</dd>
              </div>
            )}
            {snapshot.rewardsUsd > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">未领奖励</dt>
                <dd>{formatUsd(snapshot.rewardsUsd)}</dd>
              </div>
            )}
          </dl>
          {snapshot.tokens?.length > 0 && (
            <>
              <h4 className="text-sm font-medium text-gray-900 mt-4">钱包里的币</h4>
              <ul className="mt-1 text-sm text-gray-700 space-y-1">
              {snapshot.tokens.map((token) => (
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
          {snapshot.tokens?.length > 0 &&
            snapshot.walletUsd - snapshot.tokens.reduce((sum, token) => sum + token.usd, 0) >= 0.5 && (
              <p className="text-xs text-gray-400 mt-2">不足 1 美元的币已计入上面的钱包合计。</p>
            )}
          {snapshot.positions?.length > 0 && (
            <>
              <h4 className="text-sm font-medium text-gray-900 mt-4">Uniswap 头寸</h4>
              <ul className="mt-1 text-sm text-gray-700 space-y-1">
              {snapshot.positions.map((position, index) => (
                <li
                  key={`${position.chainId}-${position.version}-${index}`}
                  className="flex justify-between gap-3"
                >
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
          {snapshot.listTruncated && (
            <p className="text-xs text-gray-400 mt-3">头寸较多，上面只列出一部分，合计仍是全部未关闭头寸。</p>
          )}
          <p className="text-xs text-gray-400 mt-3">
            <a
              className="underline"
              href={`https://etherscan.io/address/${snapshot.address}`}
              target="_blank"
              rel="noreferrer"
            >
              在 Etherscan 打开这个地址
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

export default WalletAssetsPanel
