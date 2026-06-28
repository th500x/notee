/**
 * 人生片段分享海报：离屏 DOM 排版 → PNG（本人 + 已发布公开片段）。
 */
import QRCode from 'qrcode';
import { appConfig } from '@/config/appConfig';
import { formatEntryTimeLabel } from '@shared/utils/lifeResumeEntryTime.js';
import { captureSharePosterElementToBlob } from '@/utils/entrySharePosterCapture.js';
import jyhphsFontUrl from '@/assets/fonts/JYHPHS.woff2?url';

const POSTER_WIDTH_PX = 750;
const FONT_FAMILY = '"JYHPHS","Microsoft YaHei","PingFang SC",Arial,sans-serif';

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

function getPhotoCandidateUrls(item) {
  return [...new Set([item.url, item.thumbUrl].filter(Boolean))];
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * html2canvas 需无跨域污染的图片；优先原图 url，thumb 作备选。
 * 拉取成功后转 data URL，避免 OSS 处理参数导致 CORS/绘制失败。
 * @returns {Promise<string|null>}
 */
async function loadPhotoDataUrlForPoster(photo) {
  for (const url of getPhotoCandidateUrls(photo)) {
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) continue;
      return await blobToDataUrl(blob);
    } catch {
      /* 尝试下一个 URL */
    }
  }
  return null;
}

function buildPhotoGridHtml(photos) {
  if (photos.length === 0) return '';
  const cells = photos
    .map(
      (item) =>
        `<div style="aspect-ratio:1/1;overflow:hidden;border-radius:12px;background:#f1f5f9;border:1px solid #e2e8f0;">
          <img src="${escapeHtml(item.dataUrl)}" alt=""
            style="display:block;width:100%;height:100%;object-fit:cover;" />
        </div>`
    )
    .join('');
  return `<div style="margin-top:24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">${cells}</div>`;
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
    const dataUrl = await loadPhotoDataUrlForPoster(photo);
    if (dataUrl) {
      loadedPhotos.push({ ...photo, dataUrl });
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
    <div style="box-sizing:border-box;width:${POSTER_WIDTH_PX}px;padding:40px 36px 36px;background:#ffffff;">
      <div style="font-size:22px;color:#6366f1;letter-spacing:0.08em;margin-bottom:20px;">人生片段</div>
      <div style="font-size:36px;font-weight:700;line-height:1.35;color:#0f172a;">${escapeHtml(authorLabel)}</div>
      <div style="margin-top:10px;font-size:24px;color:#64748b;">${escapeHtml(timeLabel)}</div>
      ${buildTagsHtml(entry.tags)}
      ${title ? `<div style="margin-top:20px;font-size:30px;font-weight:700;line-height:1.4;color:#0f172a;">${escapeHtml(title)}</div>` : ''}
      <div style="margin-top:${title ? 16 : 20}px;font-size:28px;line-height:1.65;color:#334155;white-space:pre-wrap;word-break:break-word;">${escapeHtml(body)}</div>
      ${buildPhotoGridHtml(loadedPhotos)}
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:20px;">
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
    return await captureSharePosterElementToBlob(root, { backgroundColor: '#ffffff', scale: 2 });
  } finally {
    root.remove();
  }
}
