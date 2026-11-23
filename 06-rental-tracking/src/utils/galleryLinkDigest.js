/**
 * 房源一览「图库链接」：把已有图库收成可粘贴的一段文字。
 * 只收有分享链接、并且已经有照片的房源。出租状态只用英文 Rented / Vacant。
 */

const GALLERY_PATH_PREFIX = '/06-rental-tracking/gallery/';

export function galleryOccupancyEnglish(occupancy) {
  if (occupancy === 'rented') return 'Rented';
  if (occupancy === 'vacant') return 'Vacant';
  return '';
}

export function formatGalleryLinkCaption(room, occupancy) {
  const name = String(room || '').trim();
  const status = galleryOccupancyEnglish(occupancy);
  if (name && status) return `${name} -- ${status}`;
  return name || status;
}

export function buildGalleryLinkDigest(rows, origin) {
  const base = String(origin || '').replace(/\/$/, '');
  const blocks = [];
  for (const row of rows || []) {
    const token = typeof row?.galleryShareToken === 'string' ? row.galleryShareToken.trim() : '';
    const photos = Array.isArray(row?.photos) ? row.photos : [];
    if (!token || photos.length === 0) continue;
    const url = `${base}${GALLERY_PATH_PREFIX}${encodeURIComponent(token)}`;
    const caption = formatGalleryLinkCaption(row.room, row.galleryListing?.occupancy);
    blocks.push(caption ? `${url}\n${caption}` : url);
  }
  return blocks.join('\n\n');
}
