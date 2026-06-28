/**
 * 从图片文件名解析拍摄时间（账目图库 / 公开页展示共用）
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * @param {string} name 文件名（可含扩展名）
 * @returns {string|null} ISO 本地时间字符串，如 2026-04-15T12:34:56
 */
export function parseCaptureTimeFromFilename(name) {
  if (!name || typeof name !== 'string') return null;
  const base = name.replace(/\.[^.]+$/, '');

  // IMG_20260415_123456 或 20260415_123456
  let m = /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/i.exec(base);
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
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${m[1]}-${m[2]}-${m[3]}T12:00:00`;
    }
  }

  return null;
}

/**
 * @param {{ name?: string, capturedAt?: string, uploadedAt?: string }} photo
 * @returns {string|null}
 */
export function getPhotoCaptureIso(photo) {
  if (!photo || typeof photo !== 'object') return null;
  if (typeof photo.capturedAt === 'string' && photo.capturedAt.trim()) {
    return photo.capturedAt.trim();
  }
  const fromName = parseCaptureTimeFromFilename(photo.name || '');
  if (fromName) return fromName;
  if (typeof photo.uploadedAt === 'string' && photo.uploadedAt.trim()) {
    return photo.uploadedAt.trim();
  }
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
 * 上传完成后补全 capturedAt
 * @param {object} photo OSS 返回的照片对象
 * @param {string} [fileName] 本地文件名
 */
export function enrichUploadedPhoto(photo, fileName) {
  const name = fileName || photo.name || '';
  const capturedAt =
    parseCaptureTimeFromFilename(name) ||
    (typeof photo.uploadedAt === 'string' ? photo.uploadedAt : '') ||
    new Date().toISOString();
  return {
    ...photo,
    name: name || photo.name || '',
    capturedAt
  };
}
