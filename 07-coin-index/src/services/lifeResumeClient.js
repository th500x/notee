/**
 * 07 → 11 `/api/life-resume`（开发走 Vite proxy）。
 */

import { config } from '../config'
import { ETH_MA_CROSS } from '../constants/ethMaCross'
import { lifeResumeSession } from '../utils/lifeResumeSession'

const REQUEST_TIMEOUT_MS = 30000

function apiUrl(path) {
  const base = config.lifeResumeApiBase
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function fetchJson(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }
    const token = lifeResumeSession.getToken()
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`
    }
    const res = await fetch(apiUrl(path), {
      ...options,
      signal: controller.signal,
      headers,
    })
    const text = await res.text()
    let data = {}
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        return { success: false, status: res.status, error: `服务暂不可用（HTTP ${res.status}）` }
      }
    }
    if (data.success) {
      return { success: true, status: res.status, data: data.data, message: data.message }
    }
    return {
      success: false,
      status: res.status,
      error: data.error || data.message || `请求失败（HTTP ${res.status}）`,
      code: data.code,
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: '请求超时，请确认人生片段后端已启动' }
    }
    return { success: false, error: '无法连接通知服务，请确认人生片段后端已运行' }
  } finally {
    clearTimeout(timer)
  }
}

export async function loginLifeResumeAccount(id, password) {
  return fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ id, password }),
  })
}

export async function fetchLifeResumeMe() {
  return fetchJson('/auth/me')
}

export async function fetchVapidPublicKey() {
  return fetchJson('/push/vapid-public-key')
}

export async function fetchPushStatus(topic = ETH_MA_CROSS.TOPIC) {
  return fetchJson(`/push/status?topic=${encodeURIComponent(topic)}`)
}

export async function subscribeWebPush(body) {
  return fetchJson('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function unsubscribeWebPush(body) {
  return fetchJson('/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchEthMaCrossLatest() {
  return fetchJson('/eth-ma-cross/latest')
}

export async function fetchEthMaTradesJournal() {
  return fetchJson('/eth-ma-cross/trades-journal')
}

export async function saveEthMaTrade(body) {
  return fetchJson('/eth-ma-cross/trades', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteEthMaTrade(signalOpenTime) {
  return fetchJson(`/eth-ma-cross/trades/${encodeURIComponent(signalOpenTime)}`, {
    method: 'DELETE',
  })
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function registerCoinIndexPushWorker() {
  const scriptUrl = `${import.meta.env.BASE_URL}sw.js`
  return navigator.serviceWorker.register(scriptUrl, { scope: import.meta.env.BASE_URL })
}
