/**
 * 管理端：赛季关服切换 API（对接 /api/admin/season-rollover/*）
 *
 * 改库 / 触发执行的接口须带运营口令（后端 `SEASON_ROLLOVER_KEY`），经 `x-season-admin-key` 头传递。
 * 口令由运营在页面输入框临时填写，不持久化到 localStorage。
 */
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';

const base = `${API_CONFIG.BASE_URL}/admin/season-rollover`;

async function parseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text || res.statusText };
  }
}

function keyHeaders(adminKey) {
  const h = { 'Content-Type': 'application/json' };
  if (adminKey) h['x-season-admin-key'] = adminKey;
  return h;
}

export async function fetchOpsStatus(serverId) {
  const res = await fetchWithTimeout(`${base}/status?serverId=${encodeURIComponent(serverId)}`);
  return parseJson(res);
}

export async function setWindow(adminKey, payload) {
  const res = await fetchWithTimeout(`${base}/set-window`, {
    method: 'POST',
    headers: keyHeaders(adminKey),
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function setStatus(adminKey, serverId, status) {
  const res = await fetchWithTimeout(`${base}/set-status`, {
    method: 'POST',
    headers: keyHeaders(adminKey),
    body: JSON.stringify({ serverId, status }),
  });
  return parseJson(res);
}

export async function autoSeal(adminKey, serverId, dryRun) {
  const res = await fetchWithTimeout(`${base}/auto-seal`, {
    method: 'POST',
    headers: keyHeaders(adminKey),
    body: JSON.stringify({ serverId, dryRun }),
  });
  return parseJson(res);
}

export async function rollover(adminKey, serverId, { dryRun, runAutoSeal, confirmDestructive, backupConfirmed }) {
  const res = await fetchWithTimeout(`${base}/rollover`, {
    method: 'POST',
    headers: keyHeaders(adminKey),
    body: JSON.stringify({ serverId, dryRun, runAutoSeal, confirmDestructive, backupConfirmed }),
  });
  return parseJson(res);
}
