/**
 * 从图片文件名 / EXIF 解析拍摄时间（账目图库 / 公开页展示共用）
 * EXIF 为内联 JPEG 解析，无第三方依赖（避免部署漏跑 npm install 导致构建失败）
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

const EXIF_TAG = {
  DateTime: 0x0132,
  ExifIFD: 0x8769,
  DateTimeOriginal: 0x9003,
  DateTimeDigitized: 0x9004
};

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

function parseExifDateTimeString(s) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(s || '').trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

function readExifAscii(u8, tiffStart, get32, entryOffset, type, count) {
  if (type !== 2 || count < 1) return null;
  const valueField = entryOffset + 8;
  const dataStart = count <= 4 ? valueField : tiffStart + get32(valueField);
  if (dataStart < 0 || dataStart >= u8.length) return null;
  let s = '';
  const maxLen = Math.min(count - 1, 32, u8.length - dataStart);
  for (let i = 0; i < maxLen; i += 1) {
    const c = u8[dataStart + i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s || null;
}

function readIfdDates(u8, tiffStart, ifdRelOffset, get16, get32) {
  const ifdAbs = tiffStart + ifdRelOffset;
  if (ifdAbs + 2 > u8.length) {
    return { exifIfd: null, original: null, digitized: null, dateTime: null };
  }

  const entryCount = get16(ifdAbs);
  let exifIfd = null;
  let original = null;
  let digitized = null;
  let dateTime = null;

  for (let i = 0; i < entryCount; i += 1) {
    const entry = ifdAbs + 2 + i * 12;
    if (entry + 12 > u8.length) break;
    const tag = get16(entry);
    const type = get16(entry + 2);
    const cnt = get32(entry + 4);

    if (tag === EXIF_TAG.ExifIFD) {
      exifIfd = get32(entry + 8);
    } else if (tag === EXIF_TAG.DateTimeOriginal) {
      original = readExifAscii(u8, tiffStart, get32, entry, type, cnt);
    } else if (tag === EXIF_TAG.DateTimeDigitized) {
      digitized = readExifAscii(u8, tiffStart, get32, entry, type, cnt);
    } else if (tag === EXIF_TAG.DateTime) {
      dateTime = readExifAscii(u8, tiffStart, get32, entry, type, cnt);
    }
  }

  return { exifIfd, original, digitized, dateTime };
}

function parseJpegExifDateTime(u8, view) {
  if (u8.length < 4 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 < u8.length) {
    if (u8[offset] !== 0xff) break;
    const marker = u8[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;

    const segLen = view.getUint16(offset + 2);
    if (segLen < 2) break;

    if (marker === 0xe1 && segLen >= 8) {
      const exifHeader = offset + 4;
      if (
        u8[exifHeader] === 0x45 &&
        u8[exifHeader + 1] === 0x78 &&
        u8[exifHeader + 2] === 0x69 &&
        u8[exifHeader + 3] === 0x66 &&
        u8[exifHeader + 4] === 0x00 &&
        u8[exifHeader + 5] === 0x00
      ) {
        const tiffStart = exifHeader + 6;
        if (tiffStart + 8 > u8.length) return null;

        const le = u8[tiffStart] === 0x49 && u8[tiffStart + 1] === 0x49;
        const be = u8[tiffStart] === 0x4d && u8[tiffStart + 1] === 0x4d;
        if (!le && !be) return null;

        const get16 = (o) => view.getUint16(o, le);
        const get32 = (o) => view.getUint32(o, le);

        const ifd0 = get32(tiffStart + 4);
        const ifd0Dates = readIfdDates(u8, tiffStart, ifd0, get16, get32);

        let original = ifd0Dates.original;
        let digitized = ifd0Dates.digitized;
        const dateTime = ifd0Dates.dateTime;

        if (ifd0Dates.exifIfd != null) {
          const exifDates = readIfdDates(u8, tiffStart, ifd0Dates.exifIfd, get16, get32);
          if (exifDates.original) original = exifDates.original;
          if (exifDates.digitized) digitized = exifDates.digitized;
        }

        return parseExifDateTimeString(original || digitized || dateTime);
      }
    }

    offset += 2 + segLen;
  }

  return null;
}

/**
 * 从 JPEG EXIF 读取拍摄时间（DateTimeOriginal 优先）
 * @param {File|Blob} file
 * @returns {Promise<string|null>}
 */
export async function parseCaptureTimeFromExif(file) {
  if (!file) return null;
  try {
    const head = file.slice(0, Math.min(file.size, 512 * 1024));
    const buf = await head.arrayBuffer();
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);
    return parseJpegExifDateTime(u8, view);
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
