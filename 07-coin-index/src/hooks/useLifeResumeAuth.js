/**
 * 11 JWT 登录状态（07 订阅与操作记录共用）。
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchLifeResumeMe, loginLifeResumeAccount } from '../services/lifeResumeClient'
import {
  lifeResumeSession,
  normalizeAccountId,
  validateAccountIdFormat,
} from '../utils/lifeResumeSession'

function readStoredAccountId() {
  const user = lifeResumeSession.loadUser()
  return user?.id ? normalizeAccountId(user.id) : null
}

export function useLifeResumeAuth() {
  const [ready, setReady] = useState(false)
  const [accountId, setAccountId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refreshAuth = useCallback(async () => {
    if (!lifeResumeSession.getToken()) {
      setAccountId(null)
      return false
    }
    const me = await fetchLifeResumeMe()
    if (!me.success) {
      lifeResumeSession.clear()
      setAccountId(null)
      return false
    }
    setAccountId(normalizeAccountId(me.data?.accountId || readStoredAccountId()))
    return true
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refreshAuth()
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [refreshAuth])

  const login = useCallback(async (rawId, password) => {
    setError('')
    const id = normalizeAccountId(rawId)
    if (!id || !password) {
      setError('请输入 ID 和密码')
      return false
    }
    if (!validateAccountIdFormat(id)) {
      setError('ID 格式错误：首位 0–9，后三位 A–Z 或 0–9')
      return false
    }
    setBusy(true)
    try {
      const result = await loginLifeResumeAccount(id, password)
      if (!result.success) {
        setError(result.error || '登录失败')
        return false
      }
      lifeResumeSession.saveAuth(result.data)
      setAccountId(normalizeAccountId(result.data?.id || id))
      await refreshAuth()
      return true
    } finally {
      setBusy(false)
    }
  }, [refreshAuth])

  const logout = useCallback(() => {
    lifeResumeSession.clear()
    setAccountId(null)
    setError('')
  }, [])

  return {
    ready,
    busy,
    error,
    setError,
    accountId,
    login,
    logout,
    refreshAuth,
  }
}
