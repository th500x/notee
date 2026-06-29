/**
 * 从图片文件名 / EXIF 解析拍摄时间（账目图库 / 公开页展示共用）
 */

import exifr from 'exifr';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatLocalIsoFromDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/**
 * @param {string} name 文件名（可含扩展名）
 * @returns {string|null} ISO 本地时间字符串，如 2026-04-15T12:34:56
 */
export function parseCaptureTimeFromFilename(name) {
  if (!name || typeof name !== 'string') return null;
  const base = name.replace(/\.[^.]+$/, '');

  // WhatsApp: IMG-20250628-WA0001
  let m = /^IMG-(\d{4})(\d{2})(\d{2})-/i.exec(base);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T12:00:00`;
  }

  // IMG_20260415_123456 或 20260415_123456
  m = /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/i.exec(base);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  }

  // 2026-04-15_12-34-05 或 2026-04-15 12.34.05
  m = /(\d{4})-(\d{2})-(\d{2})[\s_T](\d{2})[-.:](\d{2})(?:[-.:](\d{2}))?/.exec(base);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}`;
  }

  // 仅日期 YYYYMMDD
  m = /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})(?:[^0-9]|$)/.exec(base);
  if (m) {
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${m[1]}-${m[2]}-${m[3]}T12:00:00`;
    }
  }

  return null;
}

/**
 * 从图片 EXIF 读取拍摄时间（DateTimeOriginal 优先）
 * @param {File|Blob} file
 * @returns {Promise<string|null>}
 */
export async function parseCaptureTimeFromExif(file) {
  if (!file) return null;
  try {
    const exif = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
      reviveValues: true
    });
    const raw = exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate;
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    return formatLocalIsoFromDate(d);
  } catch {
    return null;
  }
}

/**
 * @param {{ name?: string, capturedAt?: string, uploadedAt?: string }} photo
 * @returns {string|null}
 */
export function getPhotoCaptureIso(photo) {
  if (!photo || typeof photo !== 'object') return null;

  const fromName = parseCaptureTimeFromFilename(photo.name || '');
  if (fromName) return fromName;

  const captured = typeof photo.capturedAt === 'string' ? photo.capturedAt.trim() : '';
  const uploaded = typeof photo.uploadedAt === 'string' ? photo.uploadedAt.trim() : '';
  // 旧数据可能误把 uploadedAt 写入 capturedAt，展示时跳过
  if (captured && captured !== uploaded) return captured;

  return null;
}

/** @param {string|null|undefined} iso */
export function formatCaptureTimeDisplay(iso) {
  if (!iso || typeof iso !== 'string') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * 上传完成后补全 capturedAt：优先文件名，其次 EXIF；无则留空（不用上传时间）
 * @param {object} photo OSS 返回的照片对象
 * @param {File|Blob} [file] 本地原文件（读 EXIF）
 */
export async function enrichUploadedPhotoFromFile(photo, file) {
  const name = file?.name || photo.name || '';
  const fromName = parseCaptureTimeFromFilename(name);
  const fromExif = fromName ? null : await parseCaptureTimeFromExif(file);
  const capturedAt = fromName || fromExif || '';
  return {
    ...photo,
    name: name || photo.name || '',
    capturedAt
  };
}

/** @deprecated 请用 enrichUploadedPhotoFromFile */
export function enrichUploadedPhoto(photo, fileName) {
  const name = fileName || photo.name || '';
  const capturedAt = parseCaptureTimeFromFilename(name) || '';
  return {
    ...photo,
    name: name || photo.name || '',
    capturedAt
  };
}
