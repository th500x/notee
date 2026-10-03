/**
 * 07 周历旁：ETH Web Push 订阅 + 方案 A/B（登录态由 useLifeResumeAuth 提供）。
 */

import { useCallback, useEffect, useState } from 'react'
import { ETH_MA_CROSS } from '../constants/ethMaCross'
import { ETH_NOTIFY_PLAN } from '../constants/ethSubscribe'
import {
  fetchEthMaCrossLatest,
  fetchEthSubscribePrefs,
  fetchPushStatus,
  fetchVapidPublicKey,
  isPushSupported,
  registerCoinIndexPushWorker,
  saveEthSubscribePrefs,
  subscribeWebPush,
  unsubscribeWebPush,
  urlBase64ToUint8Array,
} from '../services/lifeResumeClient'

export function useEthMaSubscribe(auth) {
  const accountId = auth?.accountId || null
  const [ready, setReady] = useState(false)
  const [serverSubscribed, setServerSubscribed] = useState(false)
  const [thisDeviceSubscribed, setThisDeviceSubscribed] = useState(false)
  const [notifyPlan, setNotifyPlanState] = useState(ETH_NOTIFY_PLAN.DEFAULT)
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

  const refreshPrefs = useCallback(async () => {
    if (!accountId) {
      setNotifyPlanState(ETH_NOTIFY_PLAN.DEFAULT)
      return
    }
    const result = await fetchEthSubscribePrefs()
    if (result.success && result.data?.notifyPlan) {
      setNotifyPlanState(result.data.notifyPlan)
    } else {
      setNotifyPlanState(ETH_NOTIFY_PLAN.DEFAULT)
    }
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
    refreshPrefs()
  }, [refreshPushStatus, refreshPrefs])

  const setNotifyPlan = useCallback(
    async (plan) => {
      setError('')
      if (!accountId) {
        setNotifyPlanState(plan)
        return true
      }
      setBusy(true)
      try {
        const result = await saveEthSubscribePrefs(plan)
        if (!result.success) {
          setError(result.error || '保存订阅方案失败')
          return false
        }
        setNotifyPlanState(result.data?.notifyPlan || plan)
        return true
      } catch (err) {
        setError(err.message || '保存订阅方案失败')
        return false
      } finally {
        setBusy(false)
      }
    },
    [accountId]
  )

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
      const prefs = await saveEthSubscribePrefs(notifyPlan)
      if (!prefs.success) {
        setError(prefs.error || '保存订阅方案失败')
        return false
      }
      setNotifyPlanState(prefs.data?.notifyPlan || notifyPlan)

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
  }, [accountId, notifyPlan, pushSupported])

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
    notifyPlan,
    setNotifyPlan,
    latest,
    subscribe,
    unsubscribe,
  }
}
