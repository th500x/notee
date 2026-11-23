/**
 * 账目图库分库。
 * 没建过第二库时，照片仍是原来的一批，不显示库名。
 * 库名在建库或新库第一次上传时定下，之后继续上传不改名。
 */

import { getPhotoCaptureIso } from './photoCaptureTime.js';

const ALBUM_ID_RE = /^alb-[a-f0-9]{16}$/i;
const ALBUM_NAME_RE = /^\d{8}(?:-\d{1,3})?$/;

export function newGalleryAlbumId() {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `alb-${hex}`;
}

export function normalizeGalleryAlbumId(raw) {
  if (typeof raw !== 'string') return '';
  const id = raw.trim();
  return ALBUM_ID_RE.test(id) ? id.toLowerCase() : '';
}

export function normalizeGalleryAlbumName(raw) {
  if (typeof raw !== 'string') return '';
  const name = raw.trim();
  return ALBUM_NAME_RE.test(name) ? name : '';
}

/** 编辑过程中的库列表。空库也留着，供「新图库」草稿使用。 */
export function normalizeGalleryAlbumList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (out.length >= 50) break;
    if (!item || typeof item !== 'object') continue;
    const id = normalizeGalleryAlbumId(item.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: normalizeGalleryAlbumName(item.name) });
  }
  return out;
}

/**
 * 入库用。没有照片的库丢掉；照片上有库编号但列表里没有时，补一条，避免照片被并回第一批。
 */
export function normalizeStoredGalleryAlbums(rawAlbums, photos) {
  const list = normalizeGalleryAlbumList(rawAlbums);
  const used = [];
  const usedSet = new Set();
  for (const photo of photos || []) {
    const id = normalizeGalleryAlbumId(photo?.albumId);
    if (!id || usedSet.has(id)) continue;
    usedSet.add(id);
    used.push(id);
  }
  const kept = [];
  const seen = new Set();
  for (const album of list) {
    if (!usedSet.has(album.id)) continue;
    kept.push(album);
    seen.add(album.id);
  }
  for (const id of used) {
    if (seen.has(id) || kept.length >= 50) continue;
    kept.push({ id, name: '' });
    seen.add(id);
  }
  return kept;
}

export function pruneGalleryAlbums(rawAlbums, photos, { keepDrafts = false } = {}) {
  const list = normalizeGalleryAlbumList(rawAlbums);
  const used = new Set();
  for (const photo of photos || []) {
    const id = normalizeGalleryAlbumId(photo?.albumId);
    if (id) used.add(id);
  }
  return list.filter((album) => {
    if (used.has(album.id)) return true;
    return keepDrafts && !album.name;
  });
}

/** 拍摄日期取字符串里的年月日。上传时间按本机日历日。 */
export function calendarDayKeyFromCaptureIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '').trim());
  if (!match) return '';
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${match[1]}${match[2]}${match[3]}`;
}

export function calendarDayKeyFromUploadedAt(iso) {
  const text = String(iso || '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}${month}${day}`;
}

export function uniqueAlbumName(base, existingNames) {
  const taken = new Set((existingNames || []).filter((name) => typeof name === 'string' && name));
  if (!base || !ALBUM_NAME_RE.test(base)) return '';
  if (!taken.has(base)) return base;
  for (let n = 2; n <= 999; n += 1) {
    const next = `${base}-${n}`;
    if (!taken.has(next)) return next;
  }
  return '';
}

/** 有拍摄日期就用最晚的那一天；一张都没有，才用最晚的上传日。 */
export function albumNameFromPhotos(photos, existingNames) {
  const captureDays = [];
  const uploadDays = [];
  for (const photo of photos || []) {
    const captureDay = calendarDayKeyFromCaptureIso(getPhotoCaptureIso(photo));
    if (captureDay) {
      captureDays.push(captureDay);
      continue;
    }
    const uploadDay = calendarDayKeyFromUploadedAt(photo?.uploadedAt);
    if (uploadDay) uploadDays.push(uploadDay);
  }
  let base = '';
  if (captureDays.length > 0) {
    captureDays.sort();
    base = captureDays[captureDays.length - 1];
  } else if (uploadDays.length > 0) {
    uploadDays.sort();
    base = uploadDays[uploadDays.length - 1];
  }
  return uniqueAlbumName(base, existingNames);
}

export function galleryAlbumLabel(album) {
  if (album?.name) return album.name;
  if (!album?.id) return '未分组';
  return '新图库';
}

export function resolveGalleryAlbums(rawAlbums, rawPhotos) {
  const photos = Array.isArray(rawPhotos) ? rawPhotos : [];
  let stored = normalizeGalleryAlbumList(rawAlbums);
  const photoAlbumIds = [];
  for (const photo of photos) {
    const id = normalizeGalleryAlbumId(photo?.albumId);
    if (id) photoAlbumIds.push(id);
  }
  if (stored.length === 0 && photoAlbumIds.length === 0) {
    return {
      albums: [{ id: '', name: '', photos, draft: false }],
      multi: false
    };
  }
  if (stored.length === 0) {
    stored = normalizeStoredGalleryAlbums([], photos);
  }

  const byId = new Map(stored.map((album) => [album.id, { ...album, photos: [], draft: false }]));
  for (const id of photoAlbumIds) {
    if (!byId.has(id)) byId.set(id, { id, name: '', photos: [], draft: false });
  }

  const loose = [];
  for (const photo of photos) {
    const id = normalizeGalleryAlbumId(photo?.albumId);
    const bucket = id ? byId.get(id) : null;
    if (bucket) bucket.photos.push(photo);
    else loose.push(photo);
  }

  const ordered = [];
  if (loose.length > 0) {
    ordered.push({ id: '', name: '', photos: loose, draft: false });
  }
  const storedIds = new Set(stored.map((album) => album.id));
  for (const album of stored) {
    const bucket = byId.get(album.id);
    if (!bucket) continue;
    bucket.draft = !bucket.name && bucket.photos.length === 0;
    if (bucket.photos.length === 0 && bucket.name) continue;
    ordered.push(bucket);
  }
  for (const [id, bucket] of byId) {
    if (storedIds.has(id) || bucket.photos.length === 0) continue;
    bucket.draft = !bucket.name;
    ordered.push(bucket);
  }

  const filled = ordered.filter((album) => album.photos.length > 0);
  const hasDraft = ordered.some((album) => album.id && !album.name && album.photos.length === 0);
  return {
    albums: ordered,
    multi: filled.length > 1 || (filled.length >= 1 && hasDraft)
  };
}

export function beginNewGalleryAlbum(rawAlbums, rawPhotos, currentAlbumId) {
  const view = resolveGalleryAlbums(rawAlbums, rawPhotos);
  const current =
    view.albums.find((album) => album.id === (currentAlbumId || '')) ||
    view.albums[view.albums.length - 1];
  if (!current || current.photos.length === 0) return { error: 'empty-current' };

  const existingDraft = view.albums.find((album) => album.id && !album.name && album.photos.length === 0);
  if (existingDraft) {
    return {
      albums: normalizeGalleryAlbumList(rawAlbums),
      photos: rawPhotos || [],
      activeAlbumId: existingDraft.id,
      created: false
    };
  }

  let albums = normalizeGalleryAlbumList(rawAlbums);
  let photos = (rawPhotos || []).map((photo) => ({ ...photo }));
  if (!current.id) {
    const id = newGalleryAlbumId();
    const name = albumNameFromPhotos(
      current.photos,
      albums.map((album) => album.name)
    );
    if (!name) return { error: 'no-date' };
    albums = [...albums, { id, name }];
    const memberIds = new Set(current.photos.map((photo) => photo.id));
    photos = photos.map((photo) => (memberIds.has(photo.id) ? { ...photo, albumId: id } : photo));
  }

  const draftId = newGalleryAlbumId();
  albums = [...albums, { id: draftId, name: '' }];
  return { albums, photos, activeAlbumId: draftId, created: true };
}

export function appendUploadedPhotos(rawAlbums, rawPhotos, currentAlbumId, newPhotos) {
  const albumId = normalizeGalleryAlbumId(currentAlbumId);
  const tagged = (newPhotos || []).map((photo) => ({ ...photo, albumId }));
  const photos = [...(rawPhotos || []), ...tagged];
  const albums = normalizeGalleryAlbumList(rawAlbums);
  if (!albumId) return { albums, photos, failed: false, name: '' };

  const index = albums.findIndex((album) => album.id === albumId);
  if (index < 0) return { albums, photos, failed: true, name: '' };
  if (albums[index].name) return { albums, photos, failed: false, name: albums[index].name };

  const inAlbum = photos.filter((photo) => normalizeGalleryAlbumId(photo.albumId) === albumId);
  const name = albumNameFromPhotos(
    inAlbum,
    albums.filter((album) => album.id !== albumId).map((album) => album.name)
  );
  if (!name) return { albums, photos, failed: true, name: '' };
  const next = albums.slice();
  next[index] = { ...albums[index], name };
  return { albums: next, photos, failed: false, name };
}

export function removeGalleryPhotos(rawAlbums, rawPhotos, removeIds, { keepDrafts = true } = {}) {
  const drop = new Set(removeIds || []);
  const photos = (rawPhotos || []).filter((photo) => !drop.has(photo.id));
  return {
    photos,
    albums: pruneGalleryAlbums(rawAlbums, photos, { keepDrafts })
  };
}
