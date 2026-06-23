/**
 * life_entries CRUD — owner-only in P4.
 */

const { query, transaction } = require('../database/connection');
const { getProfileForAccount } = require('./lifeProfileService');
const { validateAccountIdFormat } = require('../../../05-san-storm/shared/utils/lifeResumeUsername.cjs');
const {
  validateEntryBody,
  validateEntryTitle,
} = require('../../../05-san-storm/shared/utils/lifeResumeGraphemeCount.cjs');
const { validateEntryTimeFields } = require('../../../05-san-storm/shared/utils/lifeResumeEntryTime.cjs');
const { normalizeEntryTags } = require('../../../05-san-storm/shared/utils/lifeResumeEntryTags.cjs');
const {
  resolveMediaInputForSave,
  bindParsedMediaToNewEntry,
  replaceEntryMedia,
  deleteEntryMediaFromOss,
  attachMediaMapToEntries,
  listMediaForEntryIds,
  MediaServiceError,
} = require('./lifeEntryMediaService');
const {
  parseGoogleDriveShareUrl,
  formatGoogleDriveFromRow,
  normalizeGoogleDriveDisplayLabel,
} = require('../../../05-san-storm/shared/utils/parseGoogleDriveShareUrl.cjs');
const { validateCoordinates } = require('../../../05-san-storm/shared/utils/lifeResumeLocation.cjs');
const {
  normalizeLocationPlaceName,
  normalizeLocationMapsUrl,
  parseGoogleMapsShareUrl,
} = require('../../../05-san-storm/shared/utils/parseGoogleMapsShareUrl.cjs');
const {
  reverseGeocodeToPublicLabel,
  forwardGeocodePlaceToPublicLabel,
} = require('./reverseGeocodeService');

const VISIBILITY_VALUES = new Set(['public', 'private', 'specific']);
const STATUS_VALUES = new Set(['draft', 'published']);

class EntryServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'EntryServiceError';
    this.code = code;
    this.status = status;
  }
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatEntryRow(row) {
  return {
    id: Number(row.id),
    accountId: row.account_id,
    year: row.year != null ? Number(row.year) : null,
    lifeStage: row.life_stage,
    month: row.month != null ? Number(row.month) : null,
    day: row.day != null ? Number(row.day) : null,
    timelineSortKey: Number(row.timeline_sort_key),
    isPinned: row.is_pinned === 1 || row.is_pinned === true,
    title: row.title,
    body: row.body,
    bodyGraphemeCount: Number(row.body_grapheme_count),
    visibility: row.visibility,
    granteeAccountId: row.grantee_account_id,
    tags: parseTags(row.tags),
    status: row.status,
    publishedAt: toIso(row.published_at),
    complianceAckAt: toIso(row.compliance_ack_at),
    mediaBundleType: row.media_bundle_type,
    locationCaptureMethod: row.location_capture_method,
    locationPublicLabel: row.location_public_label,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    ...formatGoogleDriveFromRow(row),
  };
}

function normalizeGranteeId(raw) {
  if (raw == null || raw === '') return null;
  const id = String(raw).trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new EntryServiceError(
      'INVALID_GRANTEE_ACCOUNT_ID',
      '特定可见对象 ID 格式错误：首位 0–9，后三位 A–Z 或 0–9'
    );
  }
  return id;
}

function parseGoogleDriveFields(input) {
  const rawUrl = input.googleDriveShareUrl;
  const hasUrlField = rawUrl !== undefined;
  const hasLabelField = input.googleDriveDisplayLabel !== undefined;

  if (!hasUrlField && !hasLabelField) {
    return undefined;
  }

  const urlText = hasUrlField ? String(rawUrl ?? '').trim() : '';
  if (!urlText) {
    if (hasLabelField && normalizeGoogleDriveDisplayLabel(input.googleDriveDisplayLabel)) {
      throw new EntryServiceError('INVALID_GOOGLE_DRIVE_URL', '填写展示名须同时提供云盘链接');
    }
    return {
      googleDriveShareUrl: null,
      googleDriveResourceId: null,
      googleDriveResourceKind: null,
      googleDriveDisplayLabel: null,
    };
  }

  const parsed = parseGoogleDriveShareUrl(urlText);
  if (!parsed.ok) {
    throw new EntryServiceError(parsed.code || 'INVALID_GOOGLE_DRIVE_URL', parsed.error);
  }

  return {
    googleDriveShareUrl: parsed.shareUrl,
    googleDriveResourceId: parsed.resourceId,
    googleDriveResourceKind: parsed.resourceKind,
    googleDriveDisplayLabel: hasLabelField
      ? normalizeGoogleDriveDisplayLabel(input.googleDriveDisplayLabel)
      : null,
  };
}

async function resolveLocationFields(input) {
  const enabled = input.locationEnabled;
  const latFieldSent = Object.prototype.hasOwnProperty.call(input, 'latitude');
  const lonFieldSent = Object.prototype.hasOwnProperty.call(input, 'longitude');
  const hasLat = latFieldSent && input.latitude !== null && String(input.latitude).trim() !== '';
  const hasLon = lonFieldSent && input.longitude !== null && String(input.longitude).trim() !== '';
  const coordsExplicitlyCleared =
    latFieldSent &&
    lonFieldSent &&
    String(input.latitude ?? '').trim() === '' &&
    String(input.longitude ?? '').trim() === '';
  const hasPlaceInput =
    input.locationPlaceName !== undefined && String(input.locationPlaceName || '').trim() !== '';
  const hasMapsInput =
    input.locationMapsUrl !== undefined && String(input.locationMapsUrl || '').trim() !== '';

  if (enabled === false || input.clearLocation === true) {
    return {
      latitude: null,
      longitude: null,
      locationCaptureMethod: 'none',
      locationPublicLabel: null,
      locationPlaceName: null,
      locationMapsUrl: null,
    };
  }

  if (
    enabled !== true &&
    !hasLat &&
    !hasLon &&
    !hasPlaceInput &&
    !hasMapsInput &&
    input.locationCaptureMethod === undefined
  ) {
    return undefined;
  }

  let placeName = normalizeLocationPlaceName(input.locationPlaceName);
  let mapsUrl = normalizeLocationMapsUrl(input.locationMapsUrl);
  let latitude = null;
  let longitude = null;

  if (mapsUrl) {
    const parsedMaps = parseGoogleMapsShareUrl(mapsUrl);
    if (!parsedMaps.ok) {
      throw new EntryServiceError(parsedMaps.code || 'INVALID_GOOGLE_MAPS_URL', parsedMaps.error);
    }
    mapsUrl = parsedMaps.shareUrl;
    if (parsedMaps.placeName && !placeName) {
      placeName = parsedMaps.placeName;
    }
    if (
      !coordsExplicitlyCleared &&
      parsedMaps.latitude != null &&
      parsedMaps.longitude != null
    ) {
      latitude = parsedMaps.latitude;
      longitude = parsedMaps.longitude;
    }
  }

  if ((latitude == null || longitude == null) && hasLat && hasLon) {
    const coordCheck = validateCoordinates(input.latitude, input.longitude);
    if (!coordCheck.ok) {
      throw new EntryServiceError(coordCheck.code || 'INVALID_LOCATION', coordCheck.error);
    }
    latitude = coordCheck.latitude;
    longitude = coordCheck.longitude;
  }

  const hasResolvedLocation = latitude != null || !!placeName || !!mapsUrl;

  if (enabled === true && !hasResolvedLocation) {
    throw new EntryServiceError(
      'INVALID_LOCATION',
      '开启位置后须填写地点名称、粘贴 Google 地图链接，或填写经纬度'
    );
  }

  if (!hasResolvedLocation) {
    return undefined;
  }

  const method = String(input.locationCaptureMethod || 'map_pick').trim();
  if (method !== 'geolocation' && method !== 'map_pick') {
    throw new EntryServiceError('INVALID_LOCATION', '位置采集方式无效');
  }

  let locationPublicLabel = null;
  try {
    if (latitude != null && longitude != null) {
      locationPublicLabel = await reverseGeocodeToPublicLabel(latitude, longitude);
    } else if (placeName) {
      locationPublicLabel = await forwardGeocodePlaceToPublicLabel(placeName);
    } else {
      throw new EntryServiceError('INVALID_LOCATION', '无法解析位置，请填写地点名称或地图链接');
    }
  } catch (err) {
    throw new EntryServiceError(
      err.code || 'GEOCODE_FAILED',
      err.message || '无法解析位置'
    );
  }

  return {
    latitude,
    longitude,
    locationCaptureMethod: hasResolvedLocation ? method : 'none',
    locationPublicLabel,
    locationPlaceName: placeName,
    locationMapsUrl: mapsUrl,
  };
}

function resolveMediaInputOrThrow(input) {
  try {
    return resolveMediaInputForSave(input);
  } catch (err) {
    if (err instanceof MediaServiceError) {
      throw new EntryServiceError(err.code, err.message, err.status);
    }
    throw err;
  }
}

function parseIsPinned(raw) {
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

function parseEntryPayload(input, profileDefaults = {}) {
  const bodyResult = validateEntryBody(input.body);
  if (!bodyResult.ok) {
    throw new EntryServiceError(bodyResult.code, bodyResult.error);
  }

  const titleResult = validateEntryTitle(input.title);
  if (!titleResult.ok) {
    throw new EntryServiceError(titleResult.code, titleResult.error);
  }

  const timeResult = validateEntryTimeFields({
    year: input.year,
    lifeStage: input.lifeStage,
    month: input.month,
    day: input.day,
  });
  if (!timeResult.ok) {
    throw new EntryServiceError(timeResult.code, timeResult.error);
  }

  const tagsResult = normalizeEntryTags(input.tags);
  if (!tagsResult.ok) {
    throw new EntryServiceError(tagsResult.code, tagsResult.error);
  }

  let visibility =
    input.visibility != null && input.visibility !== ''
      ? String(input.visibility).trim()
      : profileDefaults.pageDefaultVisibility || 'public';
  if (!VISIBILITY_VALUES.has(visibility)) {
    throw new EntryServiceError('INVALID_VISIBILITY', '权限须为 public、private 或 specific');
  }

  let granteeAccountId = null;
  if (input.granteeAccountId !== undefined) {
    granteeAccountId = normalizeGranteeId(input.granteeAccountId);
  } else if (visibility === 'specific') {
    granteeAccountId = normalizeGranteeId(profileDefaults.defaultGranteeAccountId);
  }

  if (visibility === 'specific') {
    if (!granteeAccountId) {
      throw new EntryServiceError('INVALID_GRANTEE_ACCOUNT_ID', '特定可见须填写对方 4 位 ID');
    }
  } else {
    granteeAccountId = null;
  }

  let status = input.status != null ? String(input.status).trim() : 'draft';
  if (!STATUS_VALUES.has(status)) {
    throw new EntryServiceError('INVALID_STATUS', '状态须为 draft 或 published');
  }

  const complianceAck = input.complianceAck === true || input.complianceAck === 'true';
  if (status === 'published' && !complianceAck) {
    throw new EntryServiceError('COMPLIANCE_REQUIRED', '发布前须确认内容规范');
  }

  return {
    year: timeResult.year,
    lifeStage: timeResult.lifeStage,
    month: timeResult.month,
    day: timeResult.day,
    timelineSortKey: timeResult.timelineSortKey,
    isPinned: parseIsPinned(input.isPinned),
    title: titleResult.value,
    body: bodyResult.value,
    bodyGraphemeCount: bodyResult.count,
    visibility,
    granteeAccountId,
    tags: tagsResult.tags,
    status,
    complianceAck,
  };
}

async function markFirstPublishedEntry(accountId) {
  await query(
    `UPDATE life_profiles
     SET first_entry_at = COALESCE(first_entry_at, CURRENT_TIMESTAMP(3))
     WHERE account_id = ?`,
    [accountId]
  );
}

async function listEntriesForOwner(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new EntryServiceError('INVALID_ACCOUNT_ID', '账号 ID 格式无效', 400);
  }
  await getProfileForAccount(id);
  const rows = await query(
    `SELECT * FROM life_entries
     WHERE account_id = ?
     ORDER BY is_pinned DESC, timeline_sort_key ASC, id ASC`,
    [id]
  );
  return attachMediaMapToEntries(
    rows.map((row) => formatEntryForViewer(row, { isOwner: true })),
    { includeOssKey: true, signUrls: true }
  );
}

async function getEntryForOwner(accountId, entryId) {
  const row = await findOwnedEntry(accountId, entryId);
  const [entry] = await attachMediaMapToEntries(
    [formatEntryForViewer(row, { isOwner: true })],
    {
      includeOssKey: true,
      signUrls: true,
    }
  );
  return entry;
}

async function findOwnedEntry(accountId, entryId) {
  const id = String(accountId || '').trim().toUpperCase();
  const eid = Number(entryId);
  if (!validateAccountIdFormat(id) || !Number.isInteger(eid) || eid <= 0) {
    throw new EntryServiceError('ENTRY_NOT_FOUND', '条目不存在', 404);
  }
  const rows = await query('SELECT * FROM life_entries WHERE id = ? AND account_id = ? LIMIT 1', [
    eid,
    id,
  ]);
  if (!rows[0]) {
    throw new EntryServiceError('ENTRY_NOT_FOUND', '条目不存在', 404);
  }
  return rows[0];
}

async function createEntry(accountId, input) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new EntryServiceError('INVALID_ACCOUNT_ID', '账号 ID 格式无效', 400);
  }

  const profile = await getProfileForAccount(id);
  if (profile.profileStatus === 'deactivated') {
    throw new EntryServiceError('PROFILE_DEACTIVATED', '账号处于注销冷静期，无法新建条目', 403);
  }

  const payload = parseEntryPayload(input, {
    pageDefaultVisibility: profile.pageDefaultVisibility,
    defaultGranteeAccountId: profile.defaultGranteeAccountId,
  });
  const driveFields = parseGoogleDriveFields(input) || {
    googleDriveShareUrl: null,
    googleDriveResourceId: null,
    googleDriveResourceKind: null,
    googleDriveDisplayLabel: null,
  };
  const locationFields = (await resolveLocationFields(input)) || {
    latitude: null,
    longitude: null,
    locationCaptureMethod: 'none',
    locationPublicLabel: null,
    locationPlaceName: null,
    locationMapsUrl: null,
  };

  const parsedMedia = resolveMediaInputOrThrow(input);

  const entryId = await transaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO life_entries (
        account_id, year, life_stage, month, day, timeline_sort_key, is_pinned,
        title, body, body_grapheme_count, visibility, grantee_account_id,
        tags, status, published_at, compliance_ack_at,
        google_drive_share_url, google_drive_resource_id, google_drive_resource_kind, google_drive_display_label,
        latitude, longitude, location_capture_method, location_public_label, location_place_name, location_maps_url,
        media_bundle_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        payload.year,
        payload.lifeStage,
        payload.month,
        payload.day,
        payload.timelineSortKey,
        payload.isPinned ? 1 : 0,
        payload.title,
        payload.body,
        payload.bodyGraphemeCount,
        payload.visibility,
        payload.granteeAccountId,
        JSON.stringify(payload.tags),
        payload.status,
        payload.status === 'published' ? new Date() : null,
        payload.status === 'published' ? new Date() : null,
        driveFields.googleDriveShareUrl,
        driveFields.googleDriveResourceId,
        driveFields.googleDriveResourceKind,
        driveFields.googleDriveDisplayLabel,
        locationFields.latitude,
        locationFields.longitude,
        locationFields.locationCaptureMethod,
        locationFields.locationPublicLabel,
        locationFields.locationPlaceName,
        locationFields.locationMapsUrl,
        parsedMedia.bundleType,
      ]
    );

    const newEntryId = result.insertId;

    if (parsedMedia.items.length > 0) {
      await bindParsedMediaToNewEntry(id, newEntryId, parsedMedia, conn);
    }

    if (payload.status === 'published') {
      await conn.execute(
        `UPDATE life_profiles
         SET first_entry_at = COALESCE(first_entry_at, CURRENT_TIMESTAMP(3))
         WHERE account_id = ?`,
        [id]
      );
    }

    return newEntryId;
  });

  const rows = await query('SELECT * FROM life_entries WHERE id = ? LIMIT 1', [entryId]);
  const entry = formatEntryForViewer(rows[0], { isOwner: true });
  entry.media = await listMediaForEntryIds([entryId], { includeOssKey: true, signUrls: true });
  return entry;
}

async function updateEntry(accountId, entryId, input) {
  const id = String(accountId || '').trim().toUpperCase();
  const existing = await findOwnedEntry(id, entryId);

  const profile = await getProfileForAccount(id);
  if (profile.profileStatus === 'deactivated') {
    throw new EntryServiceError('PROFILE_DEACTIVATED', '账号处于注销冷静期，无法编辑条目', 403);
  }

  const payload = parseEntryPayload(input, {
    pageDefaultVisibility: profile.pageDefaultVisibility,
    defaultGranteeAccountId: profile.defaultGranteeAccountId,
  });

  const wasPublished = existing.status === 'published';
  const willPublish = payload.status === 'published';
  const publishedAt =
    willPublish && !existing.published_at ? new Date() : existing.published_at || null;
  const complianceAckAt =
    willPublish && payload.complianceAck
      ? existing.compliance_ack_at || new Date()
      : existing.compliance_ack_at || null;

  const driveFields = parseGoogleDriveFields(input);
  const locationFields = await resolveLocationFields(input);

  if (input.mediaBundleType != null || input.mediaItems != null) {
    resolveMediaInputOrThrow(input);
  }

  const baseParams = [
    payload.year,
    payload.lifeStage,
    payload.month,
    payload.day,
    payload.timelineSortKey,
    payload.isPinned ? 1 : 0,
    payload.title,
    payload.body,
    payload.bodyGraphemeCount,
    payload.visibility,
    payload.granteeAccountId,
    JSON.stringify(payload.tags),
    payload.status,
    publishedAt,
    complianceAckAt,
  ];

  if (driveFields !== undefined && locationFields !== undefined) {
    await query(
      `UPDATE life_entries SET
        year = ?, life_stage = ?, month = ?, day = ?, timeline_sort_key = ?, is_pinned = ?,
        title = ?, body = ?, body_grapheme_count = ?, visibility = ?, grantee_account_id = ?,
        tags = ?, status = ?, published_at = ?, compliance_ack_at = ?,
        google_drive_share_url = ?, google_drive_resource_id = ?, google_drive_resource_kind = ?, google_drive_display_label = ?,
        latitude = ?, longitude = ?, location_capture_method = ?, location_public_label = ?,
        location_place_name = ?, location_maps_url = ?
       WHERE id = ? AND account_id = ?`,
      [
        ...baseParams,
        driveFields.googleDriveShareUrl,
        driveFields.googleDriveResourceId,
        driveFields.googleDriveResourceKind,
        driveFields.googleDriveDisplayLabel,
        locationFields.latitude,
        locationFields.longitude,
        locationFields.locationCaptureMethod,
        locationFields.locationPublicLabel,
        locationFields.locationPlaceName,
        locationFields.locationMapsUrl,
        Number(entryId),
        id,
      ]
    );
  } else if (driveFields !== undefined) {
    await query(
      `UPDATE life_entries SET
        year = ?, life_stage = ?, month = ?, day = ?, timeline_sort_key = ?, is_pinned = ?,
        title = ?, body = ?, body_grapheme_count = ?, visibility = ?, grantee_account_id = ?,
        tags = ?, status = ?, published_at = ?, compliance_ack_at = ?,
        google_drive_share_url = ?, google_drive_resource_id = ?, google_drive_resource_kind = ?, google_drive_display_label = ?
       WHERE id = ? AND account_id = ?`,
      [
        ...baseParams,
        driveFields.googleDriveShareUrl,
        driveFields.googleDriveResourceId,
        driveFields.googleDriveResourceKind,
        driveFields.googleDriveDisplayLabel,
        Number(entryId),
        id,
      ]
    );
  } else if (locationFields !== undefined) {
    await query(
      `UPDATE life_entries SET
        year = ?, life_stage = ?, month = ?, day = ?, timeline_sort_key = ?, is_pinned = ?,
        title = ?, body = ?, body_grapheme_count = ?, visibility = ?, grantee_account_id = ?,
        tags = ?, status = ?, published_at = ?, compliance_ack_at = ?,
        latitude = ?, longitude = ?, location_capture_method = ?, location_public_label = ?,
        location_place_name = ?, location_maps_url = ?
       WHERE id = ? AND account_id = ?`,
      [
        ...baseParams,
        locationFields.latitude,
        locationFields.longitude,
        locationFields.locationCaptureMethod,
        locationFields.locationPublicLabel,
        locationFields.locationPlaceName,
        locationFields.locationMapsUrl,
        Number(entryId),
        id,
      ]
    );
  } else {
    await query(
      `UPDATE life_entries SET
        year = ?, life_stage = ?, month = ?, day = ?, timeline_sort_key = ?, is_pinned = ?,
        title = ?, body = ?, body_grapheme_count = ?, visibility = ?, grantee_account_id = ?,
        tags = ?, status = ?, published_at = ?, compliance_ack_at = ?
       WHERE id = ? AND account_id = ?`,
      [...baseParams, Number(entryId), id]
    );
  }

  if (willPublish && !wasPublished) {
    await markFirstPublishedEntry(id);
  }

  const rows = await query('SELECT * FROM life_entries WHERE id = ? LIMIT 1', [Number(entryId)]);
  const entry = formatEntryForViewer(rows[0], { isOwner: true });

  if (
    input.mediaBundleType != null ||
    input.mediaItems != null
  ) {
    entry.media = await replaceEntryMedia(id, Number(entryId), input);
  } else {
    const withMedia = await attachMediaMapToEntries([entry], {
      includeOssKey: true,
      signUrls: true,
    });
    entry.media = withMedia[0].media;
  }
  return entry;
}

async function deleteEntry(accountId, entryId) {
  const id = String(accountId || '').trim().toUpperCase();
  await findOwnedEntry(id, entryId);
  await deleteEntryMediaFromOss(entryId);
  await query('DELETE FROM life_entries WHERE id = ? AND account_id = ?', [Number(entryId), id]);
  return { deleted: true, id: Number(entryId) };
}

function formatEntryForViewer(row, { isOwner = false } = {}) {
  const entry = formatEntryRow(row);
  delete entry.locationPlaceName;
  delete entry.locationMapsUrl;

  if (row.location_place_name) {
    entry.locationPlaceName = row.location_place_name;
  }

  if (isOwner) {
    if (row.latitude != null && row.longitude != null) {
      entry.latitude = Number(row.latitude);
      entry.longitude = Number(row.longitude);
    }
    if (row.location_maps_url) {
      entry.locationMapsUrl = row.location_maps_url;
    }
  }

  if (!isOwner) {
    delete entry.granteeAccountId;
    delete entry.complianceAckAt;
    delete entry.status;
  }
  return entry;
}

module.exports = {
  EntryServiceError,
  listEntriesForOwner,
  getEntryForOwner,
  createEntry,
  updateEntry,
  deleteEntry,
  formatEntryRow,
  formatEntryForViewer,
};
