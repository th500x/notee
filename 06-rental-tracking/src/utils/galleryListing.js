/**
 * 账目图库 — 房源说明（分享页展示）
 */

import { sanitizeIsoDateField } from './accountingDates';

export const GALLERY_LAYOUT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'studio', label: 'studio' },
  { value: '1bedroom', label: '1 bedroom' }
];

export const GALLERY_TV_TYPE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'smart', label: 'smart TV' },
  { value: 'cable', label: 'cable TV' }
];

export const GALLERY_INTERNET_OPTIONS = [
  { value: '', label: '—' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' }
];

export function emptyGalleryListing() {
  return {
    rentBaht: '',
    depositBaht: '',
    areaSqm: '',
    layout: '',
    tvInch: '',
    tvType: '',
    internet: '',
    shootDate: ''
  };
}

function trimField(raw, maxLen) {
  return typeof raw === 'string' ? raw.trim().slice(0, maxLen) : '';
}

function normalizeLayout(raw) {
  const v = trimField(raw, 20).toLowerCase();
  if (v === 'studio') return 'studio';
  if (v === '1bedroom' || v === '1 bedroom' || v === '1-bedroom') return '1bedroom';
  return '';
}

function normalizeTvType(raw) {
  const v = trimField(raw, 20).toLowerCase();
  if (v === 'smart' || v === 'smart tv') return 'smart';
  if (v === 'cable' || v === 'cable tv') return 'cable';
  return '';
}

function normalizeInternet(raw) {
  const v = trimField(raw, 10).toLowerCase();
  if (v === 'yes' || v === 'y') return 'yes';
  if (v === 'no' || v === 'n') return 'no';
  return '';
}

export function normalizeGalleryListing(raw) {
  const base = emptyGalleryListing();
  if (!raw || typeof raw !== 'object') return base;
  return {
    rentBaht: trimField(raw.rentBaht, 50),
    depositBaht: trimField(raw.depositBaht, 50),
    areaSqm: trimField(raw.areaSqm, 50),
    layout: normalizeLayout(raw.layout),
    tvInch: trimField(raw.tvInch, 20),
    tvType: normalizeTvType(raw.tvType),
    internet: normalizeInternet(raw.internet),
    shootDate: sanitizeIsoDateField(typeof raw.shootDate === 'string' ? raw.shootDate : '')
  };
}

function layoutLabel(layout) {
  if (layout === 'studio') return 'studio';
  if (layout === '1bedroom') return '1 bedroom';
  return '';
}

function tvTypeLabel(tvType) {
  if (tvType === 'smart') return 'smart TV';
  if (tvType === 'cable') return 'cable TV';
  return '';
}

function internetLabel(internet) {
  if (internet === 'yes') return 'Yes';
  if (internet === 'no') return 'No';
  return '';
}

function formatShootDateDisplay(iso) {
  const d = sanitizeIsoDateField(iso);
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  return `${m[1]}/${Number(m[2])}/${Number(m[3])}`;
}

/**
 * @returns {{ label: string, value: string }[]}
 */
export function buildGalleryListingDisplayLines(listing) {
  const L = normalizeGalleryListing(listing);
  const lines = [];

  if (L.rentBaht) lines.push({ label: '租金', value: `${L.rentBaht} baht` });
  if (L.depositBaht) lines.push({ label: '押金', value: `${L.depositBaht} baht` });
  if (L.areaSqm) lines.push({ label: '面积', value: `${L.areaSqm} sqm` });
  const layout = layoutLabel(L.layout);
  if (layout) lines.push({ label: '户型', value: layout });

  const tvParts = [];
  if (L.tvInch) tvParts.push(`${L.tvInch} inch`);
  const tvKind = tvTypeLabel(L.tvType);
  if (tvKind) tvParts.push(tvKind);
  if (tvParts.length) lines.push({ label: '电视', value: tvParts.join(', ') });

  const net = internetLabel(L.internet);
  if (net) lines.push({ label: '网络', value: net });

  const shoot = formatShootDateDisplay(L.shootDate);
  if (shoot) lines.push({ label: '拍摄日期', value: shoot });

  return lines;
}

export function hasGalleryListingContent(listing) {
  return buildGalleryListingDisplayLines(listing).length > 0;
}
