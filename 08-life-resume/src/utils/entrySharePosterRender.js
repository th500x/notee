/**
 * 人生片段分享海报：离屏 DOM 排版 → PNG（本人 + 已发布公开片段）。
 */
import QRCode from 'qrcode';
import { appConfig } from '@/config/appConfig';
import { formatEntryTimeLabel } from '@shared/utils/lifeResumeEntryTime.js';
import { countGraphemes } from '@shared/utils/lifeResumeGraphemeCount.js';
import { captureSharePosterElementToBlob } from '@/utils/entrySharePosterCapture.js';
import jyhphsFontUrl from '@/assets/fonts/JYHPHS.woff2?url';

const POSTER_WIDTH_PX = 750;
const POSTER_PADDING_X = 36;
const POSTER_PHOTO_GAP = 12;
const POSTER_PHOTO_COLUMNS = 3;
const POSTER_CONTENT_WIDTH = POSTER_WIDTH_PX - POSTER_PADDING_X * 2;
/** 与时间轴三列网格单格同宽（750 版面内） */
const POSTER_PHOTO_CELL_PX = Math.floor(
  (POSTER_CONTENT_WIDTH - POSTER_PHOTO_GAP * (POSTER_PHOTO_COLUMNS - 1)) / POSTER_PHOTO_COLUMNS
);
const FONT_FAMILY = '"JYHPHS","Microsoft YaHei","PingFang SC",Arial,sans-serif';

const POSTER_BODY_FONT_PX = 28;
const POSTER_BODY_LINE_HEIGHT = 1.65;
const POSTER_BODY_LINE_PX = Math.round(POSTER_BODY_FONT_PX * POSTER_BODY_LINE_HEIGHT);
const POSTER_CHARS_PER_LINE = Math.max(
  1,
  Math.floor(POSTER_CONTENT_WIDTH / POSTER_BODY_FONT_PX)
);
/** 档位高度在满字数之外再留几行空行，避免段间距把图撑出档 */
const POSTER_TIER_EXTRA_BLANK_LINES = 3;
/** 150 / 300 / 500：与正文上限 500 字素对齐 */
export const SHARE_POSTER_BODY_TIER_CAPS = [150, 300, 500];

/**
 * 页眉 + 位置/标签/标题预留 + 媒体一行 + 底栏。
 * 实际缺项时由 spacer 补白，同档分享图总高度一致。
 */
const POSTER_CHROME_PX =
  40 +
  (22 + 20) +
  Math.round(36 * 1.35) +
  (10 + 24) +
  (14 + Math.round(24 * 1.45) * 2) +
  (12 + 8 + Math.round(22 * 1.3)) +
  (20 + Math.round(30 * 1.4)) +
  16 +
  (24 + POSTER_PHOTO_CELL_PX) +
  (32 + 24 + 120) +
  36 +
  48;

/**
 * @param {string} bodyText
 * @returns {number}
 */
export function resolveSharePosterBodyTierCap(bodyText) {
  const count = countGraphemes(String(bodyText ?? '').trim());
  for (const cap of SHARE_POSTER_BODY_TIER_CAPS) {
    if (count <= cap) return cap;
  }
  return SHARE_POSTER_BODY_TIER_CAPS[SHARE_POSTER_BODY_TIER_CAPS.length - 1];
}

/**
 * @param {string} bodyText
 * @returns {number}
 */
export function sharePosterMinHeightPxForBody(bodyText) {
  const cap = resolveSharePosterBodyTierCap(bodyText);
  const textLines = Math.ceil(cap / POSTER_CHARS_PER_LINE);
  const bodyLines = textLines + POSTER_TIER_EXTRA_BLANK_LINES;
  return Math.ceil(POSTER_CHROME_PX + bodyLines * POSTER_BODY_LINE_PX);
}

/**
 * 把海报垫到档位高度（内容更高则不裁切、随内容加高）。
 * @param {HTMLElement} card
 * @param {HTMLElement} spacer
 * @param {string} bodyText
 */
function applySharePosterTierHeight(card, spacer, bodyText) {
  spacer.style.height = '0px';
  const minHeight = sharePosterMinHeightPxForBody(bodyText);
  const extra = Math.max(0, minHeight - card.scrollHeight);
  spacer.style.height = `${extra}px`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {string} accountId */
export function buildProfileSharePageUrl(accountId) {
  const base = appConfig.routerBasename.replace(/\/$/, '');
  const id = String(accountId || '').trim().toUpperCase();
  return `${window.location.origin}${base}/u/${id}`;
}

function listShareablePhotos(media) {
  return (Array.isArray(media) ? media : [])
    .filter((item) => item.mediaType === 'photo' && (item.thumbUrl || item.url))
    .slice(0, 3);
}

function findShareableVideo(media) {
  return (Array.isArray(media) ? media : []).find(
    (item) => item.mediaType === 'video' && item.url
  );
}

/**
 * 从视频拉首帧，裁成与照片格相同的正方形（失败则跳过，不挡整张海报）。
 * @returns {Promise<string|null>}
 */
async function loadVideoFirstFrameSquareThumb(videoItem, sizePx = POSTER_PHOTO_CELL_PX) {
  const sourceUrl = videoItem?.url;
  if (!sourceUrl) return null;

  let objectUrl = null;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    const response = await fetch(sourceUrl, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
    if (!response.ok) return null;
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);
    video.src = objectUrl;

    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('video load timeout')), 15000);
      const done = (err) => {
        window.clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      };
      video.addEventListener('loadeddata', () => done(), { once: true });
      video.addEventListener('error', () => done(new Error('video load failed')), { once: true });
      video.load();
    });

    const seekTo =
      video.duration && Number.isFinite(video.duration)
        ? Math.min(0.1, Math.max(video.duration * 0.01, 0.01))
        : 0.05;

    await new Promise((resolve) => {
      const timer = window.setTimeout(resolve, 2000);
      video.addEventListener(
        'seeked',
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      try {
        video.currentTime = seekTo;
      } catch {
        window.clearTimeout(timer);
        resolve();
      }
    });

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const scale = Math.max(sizePx / w, sizePx / h);
    const drawW = w * scale;
    const drawH = h * scale;
    ctx.drawImage(video, (sizePx - drawW) / 2, (sizePx - drawH) / 2, drawW, drawH);
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    video.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function getPhotoCandidateUrls(item) {
  return [...new Set([item.url, item.thumbUrl].filter(Boolean))];
}

async function loadImageFromBlob(blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = objectUrl;
    });
    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** 与 EntryMediaGallery 一致：正方形容器 + object-fit: cover（html2canvas 不认 CSS，改 Canvas 预裁） */
function squareCoverDataUrl(img, sizePx) {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const scale = Math.max(sizePx / w, sizePx / h);
  const drawW = w * scale;
  const drawH = h * scale;
  const dx = (sizePx - drawW) / 2;
  const dy = (sizePx - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * 拉取 OSS 图并预裁为正方形缩略 data URL（供 html2canvas 使用）。
 * @returns {Promise<string|null>}
 */
async function loadPhotoSquareThumbForPoster(photo, sizePx = POSTER_PHOTO_CELL_PX) {
  for (const url of getPhotoCandidateUrls(photo)) {
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) continue;
      const img = await loadImageFromBlob(blob);
      const dataUrl = squareCoverDataUrl(img, sizePx);
      if (dataUrl) return dataUrl;
    } catch {
      /* 尝试下一个 URL */
    }
  }
  return null;
}

function buildPhotoGridHtml(photos) {
  if (photos.length === 0) return '';
  const cell = POSTER_PHOTO_CELL_PX;
  const cells = photos
    .map((item) => {
      const videoBadge = item.isVideoFrame
        ? `<div style="position:absolute;left:10px;bottom:10px;padding:4px 10px;border-radius:6px;background:rgba(15,23,42,0.72);color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.08em;line-height:1.2;">VIDEO</div>`
        : '';
      return `<div style="position:relative;width:${cell}px;height:${cell}px;overflow:hidden;border-radius:12px;background:#f1f5f9;border:1px solid #e2e8f0;">
          <img src="${escapeHtml(item.dataUrl)}" alt="" width="${cell}" height="${cell}"
            style="display:block;width:${cell}px;height:${cell}px;" />
          ${videoBadge}
        </div>`;
    })
    .join('');
  return `<div style="margin-top:24px;display:grid;grid-template-columns:repeat(${POSTER_PHOTO_COLUMNS},${cell}px);gap:${POSTER_PHOTO_GAP}px;">${cells}</div>`;
}

function buildTagsHtml(tags) {
  const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
  if (list.length === 0) return '';
  return `<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
    ${list
      .map(
        (tag) =>
          `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:22px;line-height:1.3;">${escapeHtml(tag)}</span>`
      )
      .join('')}
  </div>`;
}

/** 与时间轴一致：模糊地址 + 具体店名（若有） */
function buildLocationHtml(entry) {
  const publicLabel = String(entry?.locationPublicLabel || '').trim();
  const placeName = String(entry?.locationPlaceName || '').trim();
  if (!publicLabel && !placeName) return '';

  let text = publicLabel ? escapeHtml(publicLabel) : '';
  if (placeName) {
    text = text ? `${text} · ${escapeHtml(placeName)}` : escapeHtml(placeName);
  }

  return `<div style="margin-top:14px;font-size:24px;line-height:1.45;color:#64748b;">📍 ${text}</div>`;
}

/**
 * @param {{
 *   entry: object,
 *   accountId: string,
 *   displayName: string,
 * }} params
 * @returns {Promise<Blob>}
 */
export async function renderEntrySharePosterBlob({ entry, accountId, displayName }) {
  const shareUrl = buildProfileSharePageUrl(accountId);
  const qrDataUrl = await QRCode.toDataURL(shareUrl, {
    width: 160,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  const photos = listShareablePhotos(entry.media);
  const loadedPhotos = [];
  for (const photo of photos) {
    const dataUrl = await loadPhotoSquareThumbForPoster(photo);
    if (dataUrl) {
      loadedPhotos.push({ ...photo, dataUrl });
    }
  }
  if (loadedPhotos.length === 0) {
    const video = findShareableVideo(entry.media);
    if (video) {
      const dataUrl = await loadVideoFirstFrameSquareThumb(video);
      if (dataUrl) {
        loadedPhotos.push({ ...video, dataUrl, isVideoFrame: true });
      }
    }
  }

  const timeLabel = formatEntryTimeLabel(entry);
  const body = String(entry.body || '').trim();
  const title = entry.title ? String(entry.title).trim() : '';
  const authorLabel = displayName || entry.username || accountId;

  const root = document.createElement('div');
  root.style.position = 'fixed';
  root.style.left = '-10000px';
  root.style.top = '0';
  root.style.width = `${POSTER_WIDTH_PX}px`;
  root.style.boxSizing = 'border-box';
  root.style.pointerEvents = 'none';
  root.style.fontFamily = FONT_FAMILY;
  root.style.color = '#0f172a';

  root.innerHTML = `
    <style>
      @font-face {
        font-family: 'JYHPHS';
        src: url('${jyhphsFontUrl}') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: block;
      }
    </style>
    <div data-share-poster-card style="box-sizing:border-box;width:${POSTER_WIDTH_PX}px;padding:40px 36px 36px;background:#ffffff;">
      <div style="font-size:22px;color:#6366f1;letter-spacing:0.08em;margin-bottom:20px;">人生片段</div>
      <div style="font-size:36px;font-weight:700;line-height:1.35;color:#0f172a;">${escapeHtml(authorLabel)}</div>
      <div style="margin-top:10px;font-size:24px;color:#64748b;">${escapeHtml(timeLabel)}</div>
      ${buildLocationHtml(entry)}
      ${buildTagsHtml(entry.tags)}
      ${title ? `<div style="margin-top:20px;font-size:30px;font-weight:700;line-height:1.4;color:#0f172a;">${escapeHtml(title)}</div>` : ''}
      <div style="margin-top:${title ? 16 : 20}px;font-size:${POSTER_BODY_FONT_PX}px;line-height:${POSTER_BODY_LINE_HEIGHT};color:#334155;white-space:pre-wrap;word-break:break-word;">${escapeHtml(body)}</div>
      <div data-share-poster-spacer style="height:0;margin:0;padding:0;line-height:0;font-size:0;"></div>
      ${buildPhotoGridHtml(loadedPhotos)}
      <div style="margin-top:${POSTER_BODY_LINE_PX}px;padding-top:24px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:20px;">
        <img src="${qrDataUrl}" alt="" width="120" height="120" style="display:block;flex-shrink:0;border-radius:8px;" />
        <div style="min-width:0;">
          <div style="font-size:24px;font-weight:600;color:#0f172a;margin-bottom:8px;">扫码看我的片段</div>
          <div style="font-size:20px;line-height:1.45;color:#64748b;word-break:break-all;">${escapeHtml(shareUrl.replace(/^https?:\/\//, ''))}</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);
  try {
    if (document.fonts?.load) {
      try {
        await document.fonts.load(`28px JYHPHS`);
      } catch {
        /* 回退系统字体 */
      }
    }
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    if (loadedPhotos.length > 0) {
      await new Promise((r) => setTimeout(r, 120));
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const card = root.querySelector('[data-share-poster-card]');
    const spacer = root.querySelector('[data-share-poster-spacer]');
    const minHeight = sharePosterMinHeightPxForBody(body);
    if (card && spacer) {
      applySharePosterTierHeight(card, spacer, body);
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const captureTarget = card || root;
    const naturalHeight = Math.round(captureTarget.scrollHeight || minHeight);
    const cssHeight = naturalHeight > minHeight ? naturalHeight : minHeight;
    if (card) {
      card.style.boxSizing = 'border-box';
      card.style.height = `${cssHeight}px`;
      card.style.overflow = 'hidden';
    }
    return await captureSharePosterElementToBlob(captureTarget, {
      backgroundColor: '#ffffff',
      scale: 2,
      targetWidth: POSTER_WIDTH_PX,
      targetHeight: cssHeight,
    });
  } finally {
    root.remove();
  }
}
