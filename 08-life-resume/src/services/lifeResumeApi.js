import { appConfig } from '@/config/appConfig';
import { lifeResumeSession } from '@/utils/lifeResumeSession';

async function parseJsonResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || data.message || `HTTP ${res.status}`;
    const err = new Error(message);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = lifeResumeSession.getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Authenticated fetch to 11 API */
export async function lifeResumeFetch(path, options = {}) {
  const url = `${appConfig.lifeResumeApiBase}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: authHeaders({
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }),
  });
  return parseJsonResponse(res);
}

/** GET /api/life-resume/health */
export async function fetchLifeResumeHealth() {
  const url = `${appConfig.lifeResumeApiBase}/health`;
  const res = await fetch(url);
  return parseJsonResponse(res);
}

/** GET /api/life-resume/auth/me */
export async function fetchAuthMe() {
  return lifeResumeFetch('/auth/me');
}

/** GET /api/life-resume/profiles/me — lazy create profile */
export async function fetchProfileMe() {
  return lifeResumeFetch('/profiles/me');
}

/** PUT /api/life-resume/profiles/me */
export async function updateProfileMe(body) {
  return lifeResumeFetch('/profiles/me', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** POST /api/life-resume/profiles/me/deactivate */
export async function deactivateProfileMe() {
  return lifeResumeFetch('/profiles/me/deactivate', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** POST /api/life-resume/profiles/me/cancel-deactivation */
export async function cancelDeactivationProfileMe() {
  return lifeResumeFetch('/profiles/me/cancel-deactivation', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** GET /api/life-resume/profiles/:accountId/public — optional auth */
export async function fetchPublicTimeline(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  return lifeResumeFetch(`/profiles/${id}/public`);
}

/** GET /api/life-resume/entries — owner list */
export async function fetchMyEntries() {
  return lifeResumeFetch('/entries');
}

/** GET /api/life-resume/entries/:id */
export async function fetchMyEntry(entryId) {
  return lifeResumeFetch(`/entries/${entryId}`);
}

/** POST /api/life-resume/entries */
export async function createEntry(body) {
  return lifeResumeFetch('/entries', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** PUT /api/life-resume/entries/:id */
export async function updateEntry(entryId, body) {
  return lifeResumeFetch(`/entries/${entryId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** POST /api/life-resume/entries/body-find-replace — 当前系列正文批量替换 */
export async function findReplaceEntryBodies({ entrySeriesId, find, replace }) {
  return lifeResumeFetch('/entries/body-find-replace', {
    method: 'POST',
    body: JSON.stringify({ entrySeriesId, find, replace }),
  });
}

/** DELETE /api/life-resume/entries/:id */
export async function deleteEntry(entryId) {
  return lifeResumeFetch(`/entries/${entryId}`, {
    method: 'DELETE',
  });
}

/** GET /api/life-resume/entry-series */
export async function fetchEntrySeries() {
  return lifeResumeFetch('/entry-series');
}

/** POST /api/life-resume/entry-series */
export async function createEntrySeries(name) {
  return lifeResumeFetch('/entry-series', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

/** PUT /api/life-resume/entry-series/:id */
export async function updateEntrySeries(seriesId, name) {
  return lifeResumeFetch(`/entry-series/${seriesId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

/** DELETE /api/life-resume/entry-series/:id */
export async function deleteEntrySeries(seriesId) {
  return lifeResumeFetch(`/entry-series/${seriesId}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirm: true }),
  });
}

/** GET /api/life-resume/home/public-cards — browse public profiles (no auth) */
export async function fetchPublicHomeCards() {
  const url = `${appConfig.lifeResumeApiBase}/home/public-cards`;
  const res = await fetch(url);
  return parseJsonResponse(res);
}

/** GET /api/life-resume/home/cards — logged-in hub */
export async function fetchHomeCards() {
  return lifeResumeFetch('/home/cards');
}

/** POST /api/life-resume/upload/sign */
export async function requestUploadSign(body) {
  return lifeResumeFetch('/upload/sign', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** POST /api/life-resume/upload/abandon — 删除尚未绑定 entry 的 OSS 对象 */
export async function abandonUploadObject(ossKey) {
  return lifeResumeFetch('/upload/abandon', {
    method: 'POST',
    body: JSON.stringify({ ossKey }),
  });
}

/** POST /api/life-resume/location/reverse-geocode — editor preview */
export async function fetchReverseGeocode(body) {
  return lifeResumeFetch('/location/reverse-geocode', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** POST /api/life-resume/location/resolve-maps-url — 展开 maps.app.goo.gl 短链接 */
export async function fetchResolveMapsUrl(mapsUrl) {
  return lifeResumeFetch('/location/resolve-maps-url', {
    method: 'POST',
    body: JSON.stringify({ mapsUrl }),
  });
}

/** GET /api/life-resume/profiles/me/life-path */
export async function fetchMyLifePath() {
  return lifeResumeFetch('/profiles/me/life-path');
}

/** POST /api/life-resume/profiles/me/life-path/generate */
export async function generateMyLifePath() {
  return lifeResumeFetch('/profiles/me/life-path/generate', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** POST /api/life-resume/profiles/me/life-path/publish */
export async function publishMyLifePath({ variant } = {}) {
  return lifeResumeFetch('/profiles/me/life-path/publish', {
    method: 'POST',
    body: JSON.stringify(variant ? { variant } : {}),
  });
}

/** DELETE /api/life-resume/profiles/me/life-path/draft */
export async function discardMyLifePathDraft() {
  return lifeResumeFetch('/profiles/me/life-path/draft', {
    method: 'DELETE',
  });
}

/** Browser PUT to OSS signed URL */
export async function uploadFileToSignedUrl(signData, file) {
  let res;
  try {
    res = await fetch(signData.uploadUrl, {
      method: signData.method || 'PUT',
      headers: signData.headers || { 'Content-Type': file.type },
      body: file,
    });
  } catch (err) {
    const message = String(err?.message || '');
    if (message === 'Failed to fetch' || err?.name === 'TypeError') {
      const corsErr = new Error(
        '照片直传 OSS 被浏览器拦截：请在阿里云 OSS 控制台为该 Bucket 配置 CORS，允许来源 https://notee.vip（或运行 backend/scripts/configure-oss-cors.js）'
      );
      corsErr.code = 'OSS_CORS_BLOCKED';
      throw corsErr;
    }
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`OSS 上传失败（HTTP ${res.status}）`);
    err.status = res.status;
    throw err;
  }
}
