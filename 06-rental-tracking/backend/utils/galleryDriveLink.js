/**
 * Google 云端硬盘文件夹链接 — 账目图库人工维护（与 OSS 双轨）
 */

const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com']);

function normalizeGalleryDriveFolderUrl(raw) {
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

module.exports = {
  normalizeGalleryDriveFolderUrl
};
