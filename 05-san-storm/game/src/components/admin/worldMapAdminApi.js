import { API_CONFIG } from '@/constants';

const base = `${API_CONFIG.BASE_URL}/admin/world-map`;

async function parseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text || res.statusText };
  }
}

export async function fetchGeoOptions() {
  const res = await fetch(`${base}/geo-options`);
  const data = await parseJson(res);
  if (!res.ok) {
    if (data && typeof data === 'object' && data.success === false) return data;
    return {
      success: false,
      error: (data && typeof data === 'object' && data.error) || `HTTP ${res.status}`,
    };
  }
  return data;
}

export async function fetchJunPresetStatus(junId) {
  const res = await fetch(`${base}/jun/${encodeURIComponent(junId)}/preset-status`);
  return parseJson(res);
}

export async function postCoordinatesToDb(junId) {
  const res = await fetch(`${base}/coordinates-to-db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ junId }),
  });
  return parseJson(res);
}

export async function postBoundariesToDb(season, edges) {
  const res = await fetch(`${base}/boundaries-to-db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ season, edges }),
  });
  return parseJson(res);
}

export async function postGenerateMergedMap(junId, seed) {
  const res = await fetch(`${base}/generate-merged-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ junId, seed: seed != null ? Number(seed) : undefined }),
  });
  return parseJson(res);
}

/** @param {string} junId @param {{ gx: number, gy: number }[]} roadCells @param {'4'|'8'} [roadConnectivity] */
export async function postSaveMergedRoadCells(junId, roadCells, roadConnectivity) {
  const res = await fetch(`${base}/save-merged-road-cells`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ junId, roadCells, roadConnectivity }),
  });
  return parseJson(res);
}

/**
 * @param {string} junId
 * @param {'player_owned' | 'npc_side'} ownershipMode
 * @param {Record<string, string|number|undefined>} counts city_small / city_medium / city_major / gate / fort（可部分填写）
 * @param {string} [season] 与 config_jun 同季，缺省则不限 season（多季同 jun_id 时会都命中）
 */
export async function postBatchNpcGarrison(junId, ownershipMode, counts, season) {
  const res = await fetch(`${base}/batch-npc-garrison`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ junId, ownershipMode, counts, season }),
  });
  return parseJson(res);
}
