/**
 * 11-life-resume 条目媒体规则
 * 须与 lifeResumeMediaRules.cjs 同步
 */

export const LIFE_MEDIA_MAX_PHOTOS = 3;
export const LIFE_MEDIA_MAX_VIDEOS = 1;

export const LIFE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const LIFE_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export const LIFE_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const LIFE_VIDEO_MIME_TYPES = ['video/mp4'];

const PHOTO_MIME_SET = new Set(LIFE_PHOTO_MIME_TYPES);
const VIDEO_MIME_SET = new Set(LIFE_VIDEO_MIME_TYPES);

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
};

export function extensionForMime(mimeType) {
  return MIME_EXT[String(mimeType || '').toLowerCase()] || null;
}

export function validateMediaUploadRequest({ mediaType, mimeType, sizeBytes, skipSizeCheck = false }) {
  const type = String(mediaType || '').trim();
  const mime = String(mimeType || '').trim().toLowerCase();
  const size = Number(sizeBytes);

  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: '文件大小无效', code: 'INVALID_MEDIA' };
  }

  if (type === 'photo') {
    if (!PHOTO_MIME_SET.has(mime)) {
      return { ok: false, error: '照片仅支持 JPG、PNG、WebP', code: 'INVALID_MEDIA' };
    }
    if (!skipSizeCheck && size > LIFE_PHOTO_MAX_BYTES) {
      return { ok: false, error: '单张照片不能超过 10MB', code: 'MEDIA_TOO_LARGE' };
    }
    return { ok: true, mediaType: 'photo', mimeType: mime, sizeBytes: size };
  }

  if (type === 'video') {
    if (!VIDEO_MIME_SET.has(mime)) {
      return { ok: false, error: '视频仅支持 MP4', code: 'INVALID_MEDIA' };
    }
    if (size > LIFE_VIDEO_MAX_BYTES) {
      return { ok: false, error: '视频不能超过 50MB', code: 'MEDIA_TOO_LARGE' };
    }
    return { ok: true, mediaType: 'video', mimeType: mime, sizeBytes: size };
  }

  return { ok: false, error: '媒体类型无效', code: 'INVALID_MEDIA' };
}

/**
 * @param {'none'|'photos'|'video'} bundleType
 * @param {Array<object>} items
 */
export function validateMediaBundle(bundleType, items) {
  const bundle = String(bundleType || 'none').trim();
  const list = Array.isArray(items) ? items : [];

  if (bundle === 'none') {
    if (list.length > 0) {
      return { ok: false, error: '未选择媒体时不应附带文件', code: 'INVALID_MEDIA_BUNDLE' };
    }
    return { ok: true, bundleType: 'none', items: [] };
  }

  if (bundle === 'photos') {
    if (list.length < 1 || list.length > LIFE_MEDIA_MAX_PHOTOS) {
      return { ok: false, error: `照片须 1–${LIFE_MEDIA_MAX_PHOTOS} 张`, code: 'INVALID_MEDIA_BUNDLE' };
    }
    if (list.some((item) => item.mediaType !== 'photo')) {
      return { ok: false, error: '照片 bundle 不能包含视频', code: 'INVALID_MEDIA_BUNDLE' };
    }
    return { ok: true, bundleType: 'photos', items: list };
  }

  if (bundle === 'video') {
    if (list.length !== LIFE_MEDIA_MAX_VIDEOS) {
      return { ok: false, error: '视频 bundle 须恰好 1 个文件', code: 'INVALID_MEDIA_BUNDLE' };
    }
    if (list[0].mediaType !== 'video') {
      return { ok: false, error: '视频 bundle 类型不匹配', code: 'INVALID_MEDIA_BUNDLE' };
    }
    return { ok: true, bundleType: 'video', items: list };
  }

  return { ok: false, error: 'mediaBundleType 无效', code: 'INVALID_MEDIA_BUNDLE' };
}
