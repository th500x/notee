/**
 * Google 云端硬盘文件夹链接 — 账目图库人工维护（与 OSS 双轨）
 */

const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com']);

/**
 * @param {string} raw
 * @returns {string} 合法 https Drive 文件夹链接，否则空串
 */
export function normalizeGalleryDriveFolderUrl(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return '';
    if (!DRIVE_HOSTS.has(parsed.hostname.toLowerCase())) return '';

    const path = parsed.pathname || '';
    if (/\/folders\/[\w-]+/i.test(path)) {
      return parsed.toString().slice(0, 2000);
    }
    if (path === '/open' || path.endsWith('/open')) {
      const id = parsed.searchParams.get('id');
      if (id && /^[\w-]+$/.test(id)) {
        return `https://drive.google.com/drive/folders/${id}`;
      }
    }
    return '';
  } catch {
    return '';
  }
}

export function isGalleryDriveFolderUrl(raw) {
  return normalizeGalleryDriveFolderUrl(raw) !== '';
}

/**
 * @param {string} raw 文件夹链接
 * @returns {string} 文件夹 ID，无法解析则空串
 */
export function extractDriveFolderId(raw) {
  const normalized = normalizeGalleryDriveFolderUrl(raw);
  if (!normalized) return '';
  const m = /\/folders\/([\w-]+)/i.exec(normalized);
  return m ? m[1] : '';
}

/**
 * Google 官方文件夹网格嵌入（须文件夹为「知道链接的人可查看」）
 * @param {string} raw 文件夹链接
 * @returns {string}
 */
export function buildDriveFolderEmbedUrl(raw) {
  const id = extractDriveFolderId(raw);
  if (!id) return '';
  return `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(id)}#grid`;
}
