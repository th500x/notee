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
        photos: formatPublicPhotos(rentRow)
      };
    }
  }
  return null;
}

function isValidPhotoObjectKey(key) {
  return typeof key === 'string' && /^photos\/\d{4}\/\d{1,2}\/[^/]+$/.test(key.trim());
}

module.exports = {
  normalizeGalleryToken,
  findPublicGalleryByToken,
  isValidPhotoObjectKey
};
