/**
 * 图库上传文件名：手机相册常给出 1000008139.jpg 等无意义名，
 * 尽量按 EXIF/修改时间还原为 IMG_YYYYMMDD_HHMMSS.jpg（与常见相机命名一致）
 */

import { parseCaptureTimeFromExif, parseCaptureTimeFromFilename } from './photoCaptureTime';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function extensionOf(fileName, mimeType) {
  const m = String(fileName || '').match(/(\.[a-zA-Z0-9]{1,8})$/);
  if (m) {
    const ext = m[1].toLowerCase();
    return ext === '.jpeg' ? '.jpg' : ext;
  }
  if (mimeType === 'image/png') return '.png';
  return '.jpg';
}

/**
 * 是否为手机/系统生成的无意义文件名
 * @param {string} name
 */
export function isGenericImageFileName(name) {
  const raw = String(name || '').trim();
  if (!raw) return true;
  const base = raw.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '');
  if (!base) return true;
  if (
    /^(image|img|photo|picture|pic|blob|file|untitled|download|screenshot)(\s*\(\d+\))?$/i.test(
      base
    )
  ) {
    return true;
  }
  // Android MediaStore 等：纯数字 1000008139
  if (/^\d{5,}$/.test(base)) return true;
  return false;
}

function isoToImgFileName(iso, ext) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  return `IMG_${m[1]}${m[2]}${m[3]}_${m[4]}${m[5]}${m[6]}${ext}`;
}

function dateToImgFileName(d, ext) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return `IMG_${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}${ext}`;
}

/**
 * 解析上传用文件名（不改动有意义的原名）
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function resolveGalleryUploadFileName(file) {
  const original = String(file?.name || 'photo.jpg').replace(/^.*[/\\]/, '');
  const ext = extensionOf(original, file?.type);

  if (!isGenericImageFileName(original)) {
    return original.includes('.') ? original : `${original}${ext}`;
  }

  const fromName = parseCaptureTimeFromFilename(original);
  const fromExif = fromName ? null : await parseCaptureTimeFromExif(file);
  const fromIso = isoToImgFileName(fromName || fromExif, ext);
  if (fromIso) return fromIso;

  const fromModified = dateToImgFileName(new Date(file?.lastModified || Date.now()), ext);
  if (fromModified) return fromModified;

  return `IMG_${Date.now()}${ext}`;
}
