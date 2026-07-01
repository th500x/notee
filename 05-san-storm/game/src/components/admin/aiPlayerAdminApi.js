/**
 * 管理端：AI 玩家管理 API（对接 /api/admin/ai-players/*）
 *
 * 页面已由 `AdminPageGate`（主站 `notee-admin-token`）保护；本模块只做 fetch + JSON 解析。
 */
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';

const base = `${API_CONFIG.BASE_URL}/admin/ai-players`;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function parseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text || res.statusText };
  }
}

export async function fetchAiPlayerStatus(serverId) {
  const q = serverId ? `?serverId=${encodeURIComponent(serverId)}` : '';
  const res = await fetchWithTimeout(`${base}/status${q}`);
  return parseJson(res);
}

export async function setFactionCount(factionId, targetCount) {
  const res = await fetchWithTimeout(`${base}/faction-count`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ factionId, targetCount }),
  });
  return parseJson(res);
}

export async function setFactionActive(factionId, active) {
  const res = await fetchWithTimeout(`${base}/faction-active`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ factionId, active }),
  });
  return parseJson(res);
}

export async function runSampleAi(factionId) {
  const res = await fetchWithTimeout(`${base}/run-sample`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(factionId ? { factionId } : {}),
  });
  return parseJson(res);
}
