/**
 * 07 周历旁：11 登录 + ETH 均线 Web Push 订阅。
 */

import { useCallback, useEffect, useState } from 'react'
import { ETH_MA_CROSS } from '../constants/ethMaCross'
import {
  fetchEthMaCrossLatest,
  fetchLifeResumeMe,
  fetchPushStatus,
  fetchVapidPublicKey,
  isPushSupported,
  loginLifeResumeAccount,
  registerCoinIndexPushWorker,
  subscribeWebPush,
  unsubscribeWebPush,
  urlBase64ToUint8Array,
} from '../services/lifeResumeClient'
import {
  lifeResumeSession,
  normalizeAccountId,
  validateAccountIdFormat,
} from '../utils/lifeResumeSession'

function readStoredAccountId() {
  const user = lifeResumeSession.loadUser()
  return user?.id ? normalizeAccountId(user.id) : null
}

export function useEthMaSubscribe() {
  const [ready, setReady] = useState(false)
  const [accountId, setAccountId] = useState(null)
  const [serverSubscribed, setServerSubscribed] = useState(false)
  const [thisDeviceSubscribed, setThisDeviceSubscribed] = useState(false)
  const [latest, setLatest] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pushSupported = isPushSupported()

  const refreshLatest = useCallback(async () => {
    const result = await fetchEthMaCrossLatest()
    if (result.success) {
      setLatest(result.data || null)
    }
  }, [])

  const refreshDeviceSubscription = useCallback(async () => {
    if (!pushSupported) {
      setThisDeviceSubscribed(false)
      return null
    }
    const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
    const sub = reg ? await reg.pushManager.getSubscription() : null
    setThisDeviceSubscribed(Boolean(sub))
    return sub
  }, [pushSupported])

  const refreshAuthAndStatus = useCallback(async () => {
    if (!lifeResumeSession.getToken()) {
      setAccountId(null)
      setServerSubscribed(false)
      return false
    }
    const me = await fetchLifeResumeMe()
    if (!me.success) {
      lifeResumeSession.clear()
      setAccountId(null)
      setServerSubscribed(false)
      return false
    }
    const id = normalizeAccountId(me.data?.accountId || readStoredAccountId())
    setAccountId(id)
    const status = await fetchPushStatus(ETH_MA_CROSS.TOPIC)
    setServerSubscribed(Boolean(status.success && status.data?.subscribed))
    return true
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refreshLatest()
      if (pushSupported) {
        try {
          await registerCoinIndexPushWorker()
        } catch {
          /* 注册失败时订阅按钮会再报错 */
        }
      }
      await refreshDeviceSubscription()
      await refreshAuthAndStatus()
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [pushSupported, refreshAuthAndStatus, refreshDeviceSubscription, refreshLatest])

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
      await refreshAuthAndStatus()
      return true
    } finally {
      setBusy(false)
    }
  }, [refreshAuthAndStatus])

  const logout = useCallback(() => {
    lifeResumeSession.clear()
    setAccountId(null)
    setServerSubscribed(false)
    setError('')
  }, [])

  const subscribe = useCallback(async () => {
    setError('')
    if (!pushSupported) {
      setError('当前浏览器不支持推送（需要 HTTPS 下的 Chrome / Edge）')
      return false
    }
    if (!accountId) {
      setError('请先登录')
      return false
    }
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('未授予通知权限。请在浏览器站点设置里允许通知后重试')
        return false
      }
      const vapid = await fetchVapidPublicKey()
      if (!vapid.success || !vapid.data?.publicKey) {
        setError(vapid.error || '推送服务尚未配置')
        return false
      }
      const reg = await registerCoinIndexPushWorker()
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.data.publicKey),
      })
      const json = sub.toJSON()
      const result = await subscribeWebPush({
        endpoint: json.endpoint,
        keys: json.keys,
        topic: ETH_MA_CROSS.TOPIC,
        userAgent: navigator.userAgent,
      })
      if (!result.success) {
        setError(result.error || '订阅失败')
        return false
      }
      setServerSubscribed(true)
      setThisDeviceSubscribed(true)
      return true
    } catch (err) {
      setError(err.message || '订阅失败')
      return false
    } finally {
      setBusy(false)
    }
  }, [accountId, pushSupported])

  const unsubscribe = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      const sub = await refreshDeviceSubscription()
      if (sub) {
        const json = sub.toJSON()
        await unsubscribeWebPush({
          endpoint: json.endpoint,
          topic: ETH_MA_CROSS.TOPIC,
        })
        await sub.unsubscribe()
      }
      setThisDeviceSubscribed(false)
      await refreshAuthAndStatus()
      return true
    } catch (err) {
      setError(err.message || '取消订阅失败')
      return false
    } finally {
      setBusy(false)
    }
  }, [refreshAuthAndStatus, refreshDeviceSubscription])

  return {
    ready,
    busy,
    error,
    accountId,
    pushSupported,
    serverSubscribed,
    thisDeviceSubscribed,
    latest,
    login,
    logout,
    subscribe,
    unsubscribe,
  }
}
