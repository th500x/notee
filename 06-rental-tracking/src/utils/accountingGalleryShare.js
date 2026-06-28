/**
 * 账目单租金行图库 — 分享链接与批量保存
 */

import { formatCaptureTimeDisplay, getPhotoCaptureIso } from './photoCaptureTime';

const GALLERY_PATH_PREFIX = '/06-rental-tracking/gallery/';

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

export function buildPhotoDownloadName(room, photo, index) {
  const iso = getPhotoCaptureIso(photo);
  const label = formatCaptureTimeDisplay(iso).replace(/[/:\s]/g, '-');
  const roomPart = sanitizeFilenamePart(room || 'ROOM');
  const extMatch = (photo.name || photo.url || '').match(/\.(jpe?g|png|webp|gif)$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg';
  return `${roomPart}_${label || `img-${index + 1}`}${ext}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPhotoBlob(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('下载失败');
  return res.blob();
}

export async function downloadSinglePhoto(room, photo, index) {
  const blob = await fetchPhotoBlob(photo.url);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = buildPhotoDownloadName(room, photo, index);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/**
 * @param {object[]} photos
 * @param {string} room
 * @param {(current: number, total: number) => void} [onProgress]
 * @returns {'share'|'sequential'}
 */
export async function saveAllGalleryPhotos(photos, room, onProgress) {
  if (!photos?.length) return 'sequential';

  const total = photos.length;
  const files = [];

  for (let i = 0; i < total; i += 1) {
    onProgress?.(i + 1, total);
    const blob = await fetchPhotoBlob(photos[i].url);
    const type = blob.type || 'image/jpeg';
    files.push(
      new File([blob], buildPhotoDownloadName(room, photos[i], i), { type })
    );
  }

  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      if (navigator.canShare({ files })) {
        await navigator.share({
          files,
          title: room ? `${room} 图片` : '图片'
        });
        return 'share';
      }
    } catch (err) {
      if (err?.name === 'AbortError') return 'share';
      /* fall through to sequential */
    }
  }

  for (let i = 0; i < files.length; i += 1) {
    onProgress?.(i + 1, total);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(files[i]);
    a.download = files[i].name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    if (i < files.length - 1) {
      await delay(450);
    }
  }

  return 'sequential';
}

export async function fetchPublicGallery(token) {
  const base =
    typeof window !== 'undefined' && window.location.origin
      ? ''
      : 'http://localhost:3003';
  const res = await fetch(
    `${base}/api/rental-tracking/public/gallery/${encodeURIComponent(token)}`
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '加载图库失败');
  }
  return data;
}
