/**
 * 07 周历旁：ETH 均线 Web Push 订阅（登录态由 useLifeResumeAuth 提供）。
 */

import { useCallback, useEffect, useState } from 'react'
import { ETH_MA_CROSS } from '../constants/ethMaCross'
import {
  fetchEthMaCrossLatest,
  fetchPushStatus,
  fetchVapidPublicKey,
  isPushSupported,
  registerCoinIndexPushWorker,
  subscribeWebPush,
  unsubscribeWebPush,
  urlBase64ToUint8Array,
} from '../services/lifeResumeClient'

export function useEthMaSubscribe(auth) {
  const accountId = auth?.accountId || null
  const [ready, setReady] = useState(false)
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

  const refreshPushStatus = useCallback(async () => {
    if (!accountId) {
      setServerSubscribed(false)
      return
    }
    const status = await fetchPushStatus(ETH_MA_CROSS.TOPIC)
    setServerSubscribed(Boolean(status.success && status.data?.subscribed))
  }, [accountId])

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
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [pushSupported, refreshDeviceSubscription, refreshLatest])

  useEffect(() => {
    refreshPushStatus()
  }, [refreshPushStatus])

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
      await refreshPushStatus()
      return true
    } catch (err) {
      setError(err.message || '取消订阅失败')
      return false
    } finally {
      setBusy(false)
    }
  }, [refreshDeviceSubscription, refreshPushStatus])

  return {
    ready,
    busy,
    error,
    accountId,
    pushSupported,
    serverSubscribed,
    thisDeviceSubscribed,
    latest,
    subscribe,
    unsubscribe,
  }
}
