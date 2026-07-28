import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';

const base = `${API_CONFIG.BASE_URL}/admin/world-map`;

async function parseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text || res.statusText };
  }
}

/** 31-1 郡战略图工坊（旧「三国地图」API 已归档） */
export async function fetchJunWorkshopCatalog() {
  const res = await fetchWithTimeout(`${base}/jun-workshop/catalog`);
  return parseJson(res);
}

export async function fetchJunWorkshop(junId) {
  const res = await fetchWithTimeout(`${base}/jun-workshop/${encodeURIComponent(junId)}`);
  return parseJson(res);
}

export function junWorkshopPreviewUrl(junId) {
  return `${base}/jun-workshop/${encodeURIComponent(junId)}/preview?t=${Date.now()}`;
}

/**
 * @param {{
 *   junId: string,
 *   cities: Array<{ cityId: string, anchorGx: number|null, anchorGy: number|null }>,
 *   battlefield?: { entryCells?: Array<{ gx: number, gy: number }> },
 *   roadCells?: Array<{ gx: number, gy: number }>,
 *   roadConnectivity?: '4'|'8',
 * }} body
 */
export async function postSaveJunWorkshop(body) {
  const res = await fetchWithTimeout(`${base}/jun-workshop/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}
