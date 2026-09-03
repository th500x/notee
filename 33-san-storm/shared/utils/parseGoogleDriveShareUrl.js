/**
 * Google 云盘分享链接解析（11-life-resume）
 * 须与 parseGoogleDriveShareUrl.cjs 同步
 */

export const GOOGLE_DRIVE_ALLOWED_HOSTS = [
  'drive.google.com',
  'docs.google.com',
  'sheets.google.com',
  'slides.google.com',
  'forms.google.com',
];

const HOST_SET = new Set(GOOGLE_DRIVE_ALLOWED_HOSTS);

function normalizeHost(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

/**
 * @param {string} raw
 * @returns {{ ok: true, empty?: boolean, shareUrl?: string, resourceId?: string, resourceKind?: string } | { ok: false, error: string, code: string }}
 */
export function parseGoogleDriveShareUrl(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return { ok: true, empty: true };
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: '请粘贴 Google 云端硬盘或文档的 https 链接',
      code: 'INVALID_GOOGLE_DRIVE_URL',
    };
  }

  if (url.protocol !== 'https:') {
    return {
      ok: false,
      error: '云盘链接须以 https:// 开头',
      code: 'INVALID_GOOGLE_DRIVE_URL',
    };
  }

  const host = normalizeHost(url.hostname);
  if (!HOST_SET.has(host)) {
    return {
      ok: false,
      error: '仅支持 Google 云端硬盘 / 文档 / 表格 / 幻灯片 / 表单链接',
      code: 'INVALID_GOOGLE_DRIVE_URL',
    };
  }

  let resourceId = null;
  let resourceKind = null;
  const path = url.pathname;

  if (host === 'drive.google.com') {
    let match = path.match(/\/file\/d\/([^/]+)/);
    if (match) {
      resourceId = match[1];
      resourceKind = 'file';
    } else {
      match = path.match(/\/folders\/([^/]+)/);
      if (match) {
        resourceId = match[1];
        resourceKind = 'folder';
      } else {
        const openId = url.searchParams.get('id');
        if (openId) {
          resourceId = openId;
          resourceKind = 'file';
        }
      }
    }
  } else if (host === 'docs.google.com') {
    const match = path.match(/\/document\/d\/([^/]+)/);
    if (match) {
      resourceId = match[1];
      resourceKind = 'document';
    }
  } else if (host === 'sheets.google.com') {
    const match = path.match(/\/spreadsheets\/d\/([^/]+)/);
    if (match) {
      resourceId = match[1];
      resourceKind = 'spreadsheet';
    }
  } else if (host === 'slides.google.com') {
    const match = path.match(/\/presentation\/d\/([^/]+)/);
    if (match) {
      resourceId = match[1];
      resourceKind = 'presentation';
    }
  } else if (host === 'forms.google.com') {
    const match = path.match(/\/forms\/d\/([^/]+)/);
    if (match) {
      resourceId = match[1];
      resourceKind = 'form';
    }
  }

  if (!resourceId || !resourceKind) {
    return {
      ok: false,
      error: '无法识别该 Google 链接，请检查是否为有效的分享 URL',
      code: 'INVALID_GOOGLE_DRIVE_URL',
    };
  }

  return {
    ok: true,
    shareUrl: url.toString(),
    resourceId,
    resourceKind,
  };
}

/**
 * @param {string|null|undefined} resourceKind
 * @param {string|null|undefined} resourceId
 */
export function buildGoogleDrivePreviewUrl(resourceKind, resourceId) {
  if (!resourceKind || !resourceId) return null;
  switch (resourceKind) {
    case 'file':
      return `https://drive.google.com/file/d/${resourceId}/preview`;
    case 'document':
      return `https://docs.google.com/document/d/${resourceId}/preview`;
    case 'spreadsheet':
      return `https://docs.google.com/spreadsheets/d/${resourceId}/preview`;
    case 'presentation':
      return `https://docs.google.com/presentation/d/${resourceId}/preview`;
    case 'form':
      return `https://docs.google.com/forms/d/${resourceId}/viewform?embedded=true`;
    case 'folder':
      return null;
    default:
      return null;
  }
}

/**
 * @param {{ google_drive_share_url?: string|null, google_drive_resource_id?: string|null, google_drive_resource_kind?: string|null, google_drive_display_label?: string|null }} row
 */
export function formatGoogleDriveFromRow(row) {
  if (!row || !row.google_drive_share_url) {
    return {
      googleDriveShareUrl: null,
      googleDriveResourceKind: null,
      googleDriveDisplayLabel: null,
      googleDrivePreviewUrl: null,
    };
  }
  return {
    googleDriveShareUrl: row.google_drive_share_url,
    googleDriveResourceKind: row.google_drive_resource_kind,
    googleDriveDisplayLabel: row.google_drive_display_label,
    googleDrivePreviewUrl: buildGoogleDrivePreviewUrl(
      row.google_drive_resource_kind,
      row.google_drive_resource_id
    ),
  };
}

/**
 * @param {string|null|undefined} displayLabel
 */
export function normalizeGoogleDriveDisplayLabel(displayLabel) {
  if (displayLabel == null || displayLabel === '') return null;
  const value = String(displayLabel).trim();
  if (!value) return null;
  return value.slice(0, 64);
}
