/**
 * 11-life-resume 条目媒体规则
 * 须与 lifeResumeMediaRules.js 同步
 */

const LIFE_MEDIA_MAX_PHOTOS = 3;
const LIFE_MEDIA_MAX_VIDEOS = 1;
const LIFE_MEDIA_MAX_DOCUMENTS = 1;

const LIFE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const LIFE_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const LIFE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const LIFE_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const LIFE_VIDEO_MIME_TYPES = ['video/mp4'];
const LIFE_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

const LIFE_DOCUMENT_ACCEPT =
  `${LIFE_DOCUMENT_MIME_TYPES.join(',')},.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt`;

const PHOTO_MIME_SET = new Set(LIFE_PHOTO_MIME_TYPES);
const VIDEO_MIME_SET = new Set(LIFE_VIDEO_MIME_TYPES);
const DOCUMENT_MIME_SET = new Set(LIFE_DOCUMENT_MIME_TYPES);

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
};

const EXT_TO_MIME = Object.fromEntries(
  Object.entries(MIME_EXT).map(([mime, ext]) => [ext, mime])
);

function extensionForMime(mimeType) {
  return MIME_EXT[String(mimeType || '').toLowerCase()] || null;
}

function resolveDocumentMimeType(mimeType, filename) {
  const mime = String(mimeType || '').trim().toLowerCase();
  if (DOCUMENT_MIME_SET.has(mime)) return mime;
  const ext = String(filename || '').split('.').pop()?.toLowerCase();
  return ext && EXT_TO_MIME[ext] ? EXT_TO_MIME[ext] : null;
}

function validateMediaUploadRequest({ mediaType, mimeType, sizeBytes, skipSizeCheck = false, filename = null }) {
  const type = String(mediaType || '').trim();
  const size = Number(sizeBytes);

  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: '文件大小无效', code: 'INVALID_MEDIA' };
  }

  if (type === 'photo') {
    const mime = String(mimeType || '').trim().toLowerCase();
    if (!PHOTO_MIME_SET.has(mime)) {
      return { ok: false, error: '照片仅支持 JPG、PNG、WebP', code: 'INVALID_MEDIA' };
    }
    if (!skipSizeCheck && size > LIFE_PHOTO_MAX_BYTES) {
      return { ok: false, error: '单张照片不能超过 10MB', code: 'MEDIA_TOO_LARGE' };
    }
    return { ok: true, mediaType: 'photo', mimeType: mime, sizeBytes: size };
  }

  if (type === 'video') {
    const mime = String(mimeType || '').trim().toLowerCase();
    if (!VIDEO_MIME_SET.has(mime)) {
      return { ok: false, error: '视频仅支持 MP4', code: 'INVALID_MEDIA' };
    }
    if (size > LIFE_VIDEO_MAX_BYTES) {
      return { ok: false, error: '视频不能超过 50MB', code: 'MEDIA_TOO_LARGE' };
    }
    return { ok: true, mediaType: 'video', mimeType: mime, sizeBytes: size };
  }

  if (type === 'document') {
    const mime = resolveDocumentMimeType(mimeType, filename);
    if (!mime) {
      return {
        ok: false,
        error: '文档仅支持 PDF、Word、Excel、PPT、TXT',
        code: 'INVALID_MEDIA',
      };
    }
    if (size > LIFE_DOCUMENT_MAX_BYTES) {
      return { ok: false, error: '文档不能超过 10MB', code: 'MEDIA_TOO_LARGE' };
    }
    return { ok: true, mediaType: 'document', mimeType: mime, sizeBytes: size };
  }

  return { ok: false, error: '媒体类型无效', code: 'INVALID_MEDIA' };
}

function validateMediaBundle(bundleType, items) {
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
      return { ok: false, error: '照片 bundle 类型不匹配', code: 'INVALID_MEDIA_BUNDLE' };
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

  if (bundle === 'document') {
    if (list.length !== LIFE_MEDIA_MAX_DOCUMENTS) {
      return { ok: false, error: '文档 bundle 须恰好 1 个文件', code: 'INVALID_MEDIA_BUNDLE' };
    }
    if (list[0].mediaType !== 'document') {
      return { ok: false, error: '文档 bundle 类型不匹配', code: 'INVALID_MEDIA_BUNDLE' };
    }
    return { ok: true, bundleType: 'document', items: list };
  }

  return { ok: false, error: 'mediaBundleType 无效', code: 'INVALID_MEDIA_BUNDLE' };
}

module.exports = {
  LIFE_MEDIA_MAX_PHOTOS,
  LIFE_MEDIA_MAX_VIDEOS,
  LIFE_MEDIA_MAX_DOCUMENTS,
  LIFE_PHOTO_MAX_BYTES,
  LIFE_VIDEO_MAX_BYTES,
  LIFE_DOCUMENT_MAX_BYTES,
  LIFE_PHOTO_MIME_TYPES,
  LIFE_VIDEO_MIME_TYPES,
  LIFE_DOCUMENT_MIME_TYPES,
  LIFE_DOCUMENT_ACCEPT,
  extensionForMime,
  resolveDocumentMimeType,
  validateMediaUploadRequest,
  validateMediaBundle,
};
