/**
 * 登录后拉取 / 保存 ETH 均线操作记录。
 */

import { useCallback, useEffect, useState } from 'react'
import {
  deleteEthMaTrade,
  fetchEthMaTradesJournal,
  saveEthMaTrade,
} from '../services/lifeResumeClient'

export function useEthMaTradeLogs(accountId) {
  const [recentSignals, setRecentSignals] = useState([])
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(Boolean(accountId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!accountId) {
      setRecentSignals([])
      setTrades([])
      setLoading(false)
      return { ok: false }
    }
    const result = await fetchEthMaTradesJournal()
    if (!result.success) {
      setError(result.error || '无法加载操作记录')
      setLoading(false)
      return { ok: false }
    }
    setError('')
    setRecentSignals(result.data?.recentSignals || [])
    setTrades(result.data?.trades || [])
    setLoading(false)
    return { ok: true }
  }, [accountId])

  useEffect(() => {
    setLoading(Boolean(accountId))
    refresh()
  }, [accountId, refresh])

  const save = useCallback(async (body) => {
    setBusy(true)
    setError('')
    try {
      const result = await saveEthMaTrade(body)
      if (!result.success) {
        setError(result.error || '保存失败')
        return false
      }
      await refresh()
      return true
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const remove = useCallback(async (signalOpenTime) => {
    setBusy(true)
    setError('')
    try {
      const result = await deleteEthMaTrade(signalOpenTime)
      if (!result.success) {
        setError(result.error || '删除失败')
        return false
      }
      await refresh()
      return true
    } finally {
      setBusy(false)
    }
  }, [refresh])

  return {
    recentSignals,
    trades,
    loading,
    busy,
    error,
    setError,
    refresh,
    save,
    remove,
  }
}
