/**
 * Android 相册经 <input type="file"> 常返回 1000006336.jpg 等占位名。
 * 若文件名像系统占位，尝试从 EXIF DateTimeOriginal 还原为 IMG_YYYYMMDD_HHMMSS.ext。
 */

const GENERIC_MOBILE_FILENAME =
  /^(?:\d{6,}|image(?:_\d+)?|photo(?:_\d+)?|picture(?:_\d+)?|blob|temp|tmp|capture)(?:\.\w+)?$/i;

function isGenericMobilePhotoFilename(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return true;
  const base = trimmed.replace(/\.[^.]+$/, '');
  return GENERIC_MOBILE_FILENAME.test(base) || GENERIC_MOBILE_FILENAME.test(trimmed);
}

function extensionFromMime(mimeType, fallback = 'jpg') {
  const mime = String(mimeType || '').toLowerCase();
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/jpeg') return 'jpg';
  const fromName = String(fallback).split('.').pop()?.toLowerCase();
  return fromName === 'jpeg' ? 'jpg' : fromName || 'jpg';
}

function formatCameraStyleFilename(date, ext) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `IMG_${y}${m}${d}_${h}${min}${s}.${ext}`;
}

function parseExifDateTimeOriginal(buffer) {
  if (!buffer || buffer.byteLength < 4) return null;
  const view = new DataView(buffer);
  if (view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 < buffer.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda) break;
    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2) break;

    if (marker === 0xe1) {
      const exifStart = offset + 4;
      if (exifStart + 6 > buffer.byteLength) break;
      const header = String.fromCharCode(
        view.getUint8(exifStart),
        view.getUint8(exifStart + 1),
        view.getUint8(exifStart + 2),
        view.getUint8(exifStart + 3)
      );
      if (header !== 'Exif') {
        offset += 2 + segmentLength;
        continue;
      }

      const tiffStart = exifStart + 6;
      const le = view.getUint8(tiffStart) === 0x49 && view.getUint8(tiffStart + 1) === 0x49;
      const be = view.getUint8(tiffStart) === 0x4d && view.getUint8(tiffStart + 1) === 0x4d;
      if (!le && !be) break;

      const readUint16 = (pos) => view.getUint16(pos, le);
      const readUint32 = (pos) => view.getUint32(pos, le);

      const ifd0Offset = readUint32(tiffStart + 4);
      const ifd0 = tiffStart + ifd0Offset;
      if (ifd0 + 2 > buffer.byteLength) break;

      const entryCount = readUint16(ifd0);
      for (let i = 0; i < entryCount; i += 1) {
        const entry = ifd0 + 2 + i * 12;
        if (entry + 12 > buffer.byteLength) break;
        const tag = readUint16(entry);
        if (tag !== 0x0132) continue;

        const type = readUint16(entry + 2);
        const count = readUint32(entry + 4);
        if (type !== 2 || count < 10) continue;

        let valueOffset = readUint32(entry + 8);
        let valueStart = tiffStart + valueOffset;
        if (count <= 4) valueStart = entry + 8;

        let raw = '';
        for (let j = 0; j < count - 1; j += 1) {
          if (valueStart + j >= buffer.byteLength) break;
          raw += String.fromCharCode(view.getUint8(valueStart + j));
        }

        const match = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
        if (!match) return null;
        return new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6])
        );
      }
    }

    offset += 2 + segmentLength;
  }

  return null;
}

async function readExifDateTimeOriginal(file) {
  const head = await file.slice(0, Math.min(file.size, 256 * 1024)).arrayBuffer();
  return parseExifDateTimeOriginal(head);
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function resolvePhotoOriginalFilename(file) {
  const browserName = String(file?.name || '').trim();
  if (!isGenericMobilePhotoFilename(browserName)) {
    return browserName || 'photo.jpg';
  }

  try {
    const takenAt = await readExifDateTimeOriginal(file);
    if (takenAt && !Number.isNaN(takenAt.getTime())) {
      const ext = extensionFromMime(file.type, browserName);
      return formatCameraStyleFilename(takenAt, ext);
    }
  } catch {
    // fall through to browser name
  }

  return browserName || 'photo.jpg';
}

export { isGenericMobilePhotoFilename };
