/**
 * 账目单租金行图库 — 分享链接与批量保存
 */

import { formatCaptureTimeDisplay, getPhotoCaptureIso } from './photoCaptureTime';

const GALLERY_PATH_PREFIX = '/06-rental-tracking/gallery/';
/** 并行拉取 OSS 代理，缩短「下载全部」准备时间 */
const FETCH_CONCURRENCY = 4;
/** 微信等 App 单次分享约 9 张；网页无法突破，按此分批多次分享 */
export const SHARE_BATCH_SIZE = 9;

/** @param {File[]} files @param {number} [size] */
export function splitGalleryShareBatches(files, size = SHARE_BATCH_SIZE) {
  const list = Array.isArray(files) ? files : [];
  const batchSize = Math.max(1, size || SHARE_BATCH_SIZE);
  const batches = [];
  for (let i = 0; i < list.length; i += batchSize) {
    batches.push(list.slice(i, i + batchSize));
  }
  return batches;
}

export function newGalleryShareToken() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }
  } catch {
    /* ignore */
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function buildGalleryShareUrl(token) {
  if (!token) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${GALLERY_PATH_PREFIX}${encodeURIComponent(token)}`;
}

export async function copyGalleryShareUrl(token) {
  const url = buildGalleryShareUrl(token);
  if (!url) throw new Error('尚未生成分享链接');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return url;
  }
  const ta = document.createElement('textarea');
  ta.value = url;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return url;
}

function sanitizeFilenamePart(s) {
  return String(s || 'photo')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 40);
}

/** 优先保留上传时的原始文件名；无原名时再回退 room+拍摄时间 */
export function buildPhotoDownloadName(room, photo, index) {
  const original = String(photo?.name || '').trim();
  if (original) {
    const safe = original.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 120);
    if (safe) return safe;
  }
  const iso = getPhotoCaptureIso(photo);
  const label = formatCaptureTimeDisplay(iso).replace(/[/:\s]/g, '-');
  const roomPart = sanitizeFilenamePart(room || 'ROOM');
  const extMatch = (photo.url || '').match(/\.(jpe?g|png|webp|gif)$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg';
  return `${roomPart}_${label || `img-${index + 1}`}${ext}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiBaseForBrowser() {
  return typeof window !== 'undefined' && window.location.origin ? '' : 'http://localhost:3003';
}

/** 经后端代理下载，避免 OSS 直链 CORS */
export function buildGalleryPhotoDownloadUrl(token, photoId) {
  if (!token || !photoId) return '';
  return `${apiBaseForBrowser()}/api/rental-tracking/public/gallery/${encodeURIComponent(token)}/download?key=${encodeURIComponent(photoId)}`;
}

async function fetchPhotoBlob(token, photo) {
  const url = buildGalleryPhotoDownloadUrl(token, photo.id);
  if (!url) throw new Error('无效的图片');
  const res = await fetch(url);
  if (!res.ok) {
    let msg = '下载失败';
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.blob();
}

/** 有限并发 map，保持结果顺序 */
async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  const pool = Math.min(Math.max(1, concurrency), items.length || 1);
  await Promise.all(Array.from({ length: pool }, () => worker()));
  return results;
}

/**
 * 浏览器是否支持「文件分享」（可进相册的关键路径）
 * 须在用户手势内尽早调用探测
 */
export function probeCanShareFiles() {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    const probe = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'probe.jpg', {
      type: 'image/jpeg'
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * 并行拉取全部图片为 File[]（准备阶段，不触发下载）
 * @returns {Promise<File[]>}
 */
export async function prepareGalleryPhotoFiles(token, photos, room, onProgress) {
  if (!photos?.length) return [];
  const total = photos.length;
  let completed = 0;

  const files = await mapWithConcurrency(photos, FETCH_CONCURRENCY, async (photo, index) => {
    const blob = await fetchPhotoBlob(token, photo);
    completed += 1;
    onProgress?.(completed, total);
    const type = blob.type || 'image/jpeg';
    return new File([blob], buildPhotoDownloadName(room, photo, index), { type });
  });

  return files;
}

/**
 * 分享单批文件（须在用户点击手势内调用）
 * AbortError：多数 App 发送成功或用户关闭面板都会抛出，视为本批已结束
 * @returns {'shared'|'unsupported'}
 */
export async function shareGalleryPhotoBatch(batch, room) {
  if (!batch?.length) return 'unsupported';
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unsupported';
  }
  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: batch })) {
    return 'unsupported';
  }
  const title = room ? `${room} 图片` : '图片';
  try {
    await navigator.share({ files: batch, title });
    return 'shared';
  } catch (err) {
    if (err?.name === 'AbortError') {
      return 'shared';
    }
    return 'unsupported';
  }
}

/**
 * 连续分批分享（第二批起常需新的用户手势；自动分享失败时由 onNeedContinue 等待再点）
 * @param {File[]} files
 * @param {string} room
 * @param {(cur: number, total: number) => void} [onBatchProgress]
 * @param {{ onNeedContinue?: (next: number, total: number) => Promise<void> }} [options]
 * @returns {'share'|'unsupported'}
 */
export async function shareGalleryPhotoFiles(files, room, onBatchProgress, options = {}) {
  if (!files?.length) return 'unsupported';
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unsupported';
  }

  const batches = splitGalleryShareBatches(files);
  const onNeedContinue = options?.onNeedContinue;

  for (let b = 0; b < batches.length; b += 1) {
    onBatchProgress?.(b + 1, batches.length);
    let result = await shareGalleryPhotoBatch(batches[b], room);

    // 非首批可能因缺少用户手势失败：等用户再点后重试本批
    if (result === 'unsupported' && b > 0 && typeof onNeedContinue === 'function') {
      await onNeedContinue(b + 1, batches.length);
      result = await shareGalleryPhotoBatch(batches[b], room);
    }

    if (result !== 'shared') {
      return 'unsupported';
    }

    if (b < batches.length - 1) {
      if (typeof onNeedContinue === 'function') {
        // 下一批必须再点一次（系统限制 + 保留手势）
        await onNeedContinue(b + 2, batches.length);
      } else {
        await delay(400);
      }
    }
  }
  return 'share';
}

/** 浏览器直存：通常进「下载」目录，无法写入系统相册 */
export async function downloadGalleryFilesSequential(files, onProgress) {
  if (!files?.length) return 'sequential';
  const total = files.length;
  for (let i = 0; i < total; i += 1) {
    onProgress?.(i + 1, total);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(files[i]);
    a.download = files[i].name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    if (i < total - 1) {
      await delay(350);
    }
  }
  return 'sequential';
}

/**
 * PC 备选：每次经代理 URL 触发下载（不缓存 blob，减轻二次点击被拦）
 */
export async function downloadAllViaProxyUrls(token, photos, room, onProgress) {
  if (!photos?.length) return 'sequential';
  const total = photos.length;
  for (let i = 0; i < total; i += 1) {
    onProgress?.(i + 1, total);
    const url = buildGalleryPhotoDownloadUrl(token, photos[i].id);
    if (!url) continue;
    const a = document.createElement('a');
    a.href = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}_${i}`;
    a.download = buildPhotoDownloadName(room, photos[i], i);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (i < total - 1) {
      await delay(450);
    }
  }
  return 'sequential';
}

export async function downloadSinglePhoto(token, room, photo, index) {
  const blob = await fetchPhotoBlob(token, photo);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = buildPhotoDownloadName(room, photo, index);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/**
 * 兼容旧调用：准备后立即尝试分享，失败则逐张下载（易进「下载」目录）
 * 公开页请改用 prepare + share 两步，以保留用户手势写入相册
 */
export async function saveAllGalleryPhotos(token, photos, room, onProgress) {
  const files = await prepareGalleryPhotoFiles(token, photos, room, onProgress);
  const shared = await shareGalleryPhotoFiles(files, room);
  if (shared === 'share') return 'share';
  return downloadGalleryFilesSequential(files, onProgress);
}

export async function fetchPublicGallery(token) {
  const base =
    typeof window !== 'undefined' && window.location.origin
      ? ''
      : 'http://localhost:3003';
  const res = await fetch(
    `${base}/api/rental-tracking/public/gallery/${encodeURIComponent(token)}`
  );
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok || !data.success) {
    const err = new Error(data.error || '加载图库失败');
    err.status = res.status;
    err.code = data.error || '';
    throw err;
  }
  return data;
}
