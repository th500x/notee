/**
 * 公开账目图库：按 share token 在 accounting 项目中查找租金行图库
 */

const { pool } = require('../database/connection');
const { normalizeAccountingSheet } = require('./accountingSheet');
const { parseJSON } = require('./jsonParser');

function normalizeGalleryToken(raw) {
  const token = (raw || '').trim();
  if (!token || token.length > 80 || !/^[\w-]+$/.test(token)) return null;
  return token;
}

function formatPublicPhotos(rentRow) {
  return (rentRow.photos || []).map((p) => ({
    id: p.id,
    url: p.url,
    name: p.name || '',
    capturedAt: p.capturedAt || '',
    uploadedAt: p.uploadedAt || ''
  }));
}

/**
 * @param {string} token
 * @returns {Promise<{ room: string, photos: object[] } | null>}
 */
async function findPublicGalleryByToken(token) {
  const normalized = normalizeGalleryToken(token);
  if (!normalized) return null;

  const [rows] = await pool.execute(
    "SELECT accounting_sheet FROM projects WHERE COALESCE(project_kind, 'rental') = 'accounting'"
  );

  for (const dbRow of rows) {
    const sheet = normalizeAccountingSheet(parseJSON(dbRow.accounting_sheet, null));
    for (const rentRow of sheet.rentRows) {
      if (rentRow.galleryShareToken !== normalized) continue;
      return {
        room: rentRow.room || '',
        photos: formatPublicPhotos(rentRow),
        driveFolderUrl: rentRow.galleryDriveFolderUrl || '',
        listing: rentRow.galleryListing || {}
      };
    }
  }
  return null;
}

/**
 * 允许：
 * - 历史凭证：`photos/YYYY/M(M)/file`
 * - 账目图库：`photos/gallery/{ROOM}/file`
 */
function isValidPhotoObjectKey(key) {
  if (typeof key !== 'string') return false;
  const k = key.trim();
  if (!k || k.includes('..') || k.length > 512) return false;
  return (
    /^photos\/\d{4}\/\d{1,2}\/[^/]+$/.test(k) ||
    /^photos\/gallery\/[^/]+\/[^/]+$/.test(k)
  );
}

module.exports = {
  normalizeGalleryToken,
  findPublicGalleryByToken,
  isValidPhotoObjectKey
};
