/**
 * 账目图库 — 房源说明（分享页展示）
 */

import { sanitizeIsoDateField } from './accountingDates';
import { getGalleryShareMessages } from './galleryShareI18n';

export const GALLERY_LAYOUT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'studio', label: 'studio' },
  { value: '1bedroom', label: '1 bedroom' }
];

export const GALLERY_TV_TYPE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'smart', label: 'smart tv' },
  { value: 'cable', label: 'cable tv' }
];

export const GALLERY_INTERNET_OPTIONS = [
  { value: '', label: '—' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' }
];

export const GALLERY_OCCUPANCY_OPTIONS = [
  { value: 'vacant', label: '未出租' },
  { value: 'rented', label: '已出租' }
];

export function emptyGalleryListing() {
  return {
    condo: '',
    building: '',
    occupancy: '',
    rentBaht: '',
    depositBaht: '',
    areaSqm: '',
    layout: '',
    electricFee: '',
    waterFee: '',
    tvInch: '',
    tvType: '',
    internet: '',
    doorAccess: '',
    shootDate: ''
  };
}

function trimField(raw, maxLen) {
  return typeof raw === 'string' ? raw.trim().slice(0, maxLen) : '';
}

/** 编辑态保留空格；仅截断长度（trim 会在输入时吞掉未完成的空格） */
function sliceField(raw, maxLen) {
  return typeof raw === 'string' ? raw.slice(0, maxLen) : '';
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

function normalizeOccupancy(raw) {
  const v = trimField(raw, 20).toLowerCase();
  if (v === 'rented' || v === '已出租') return 'rented';
  if (v === 'vacant' || v === '未出租') return 'vacant';
  return '';
}

export function normalizeGalleryListing(raw) {
  const base = emptyGalleryListing();
  if (!raw || typeof raw !== 'object') return base;
  return {
    condo: sliceField(raw.condo, 100),
    building: sliceField(raw.building, 100),
    occupancy: normalizeOccupancy(raw.occupancy),
    rentBaht: sliceField(raw.rentBaht, 50),
    depositBaht: sliceField(raw.depositBaht, 50),
    areaSqm: sliceField(raw.areaSqm, 50),
    layout: normalizeLayout(raw.layout),
    electricFee: sliceField(raw.electricFee, 100),
    waterFee: sliceField(raw.waterFee, 100),
    tvInch: sliceField(raw.tvInch, 20),
    tvType: normalizeTvType(raw.tvType),
    internet: normalizeInternet(raw.internet),
    doorAccess: sliceField(raw.doorAccess, 100),
    shootDate: sanitizeIsoDateField(typeof raw.shootDate === 'string' ? raw.shootDate : '')
  };
}

function layoutLabel(layout, locale = 'zh') {
  const m = getGalleryShareMessages(locale);
  if (layout === 'studio') return m.layoutStudio;
  if (layout === '1bedroom') return m.layout1bedroom;
  return '';
}

function tvTypeLabel(tvType, locale = 'zh') {
  const m = getGalleryShareMessages(locale);
  if (tvType === 'smart') return m.tvSmart;
  if (tvType === 'cable') return m.tvCable;
  return '';
}

function internetLabel(internet, locale = 'zh') {
  const m = getGalleryShareMessages(locale);
  if (internet === 'yes') return m.internetYes;
  if (internet === 'no') return m.internetNo;
  return '';
}

function occupancyLabel(occupancy, locale = 'zh') {
  const m = getGalleryShareMessages(locale);
  if (occupancy === 'rented') return m.occupancyRented;
  if (occupancy === 'vacant') return m.occupancyVacant;
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
 * @param {object} listing
 * @param {'zh'|'en'|'th'} [locale]
 * @returns {{ label: string, value: string }[]}
 */
export function buildGalleryListingDisplayLines(listing, locale = 'zh') {
  const L = normalizeGalleryListing(listing);
  const m = getGalleryShareMessages(locale);
  const lines = [];

  const condo = L.condo.trim();
  if (condo) lines.push({ label: m.labelCondo, value: condo });
  const building = L.building.trim();
  if (building) lines.push({ label: m.labelBuilding, value: building });
  const occupancy = occupancyLabel(L.occupancy, locale);
  if (occupancy) lines.push({ label: m.labelOccupancy, value: occupancy });
  const rentBaht = L.rentBaht.trim();
  if (rentBaht) lines.push({ label: m.labelRent, value: `${rentBaht} ${m.unitBaht}` });
  const depositBaht = L.depositBaht.trim();
  if (depositBaht) lines.push({ label: m.labelDeposit, value: `${depositBaht} ${m.unitBaht}` });
  const areaSqm = L.areaSqm.trim();
  if (areaSqm) lines.push({ label: m.labelArea, value: `${areaSqm} ${m.unitSqm}` });
  const layout = layoutLabel(L.layout, locale);
  if (layout) lines.push({ label: m.labelLayout, value: layout });

  const electricFee = L.electricFee.trim();
  if (electricFee) lines.push({ label: m.labelElectricFee, value: electricFee });
  const waterFee = L.waterFee.trim();
  if (waterFee) lines.push({ label: m.labelWaterFee, value: waterFee });

  const tvParts = [];
  if (L.tvInch) tvParts.push(`${L.tvInch} ${m.unitInch}`);
  const tvKind = tvTypeLabel(L.tvType, locale);
  if (tvKind) tvParts.push(tvKind);
  if (tvParts.length) lines.push({ label: m.labelTv, value: tvParts.join(', ') });

  const net = internetLabel(L.internet, locale);
  if (net) lines.push({ label: m.labelInternet, value: net });

  const doorAccess = L.doorAccess.trim();
  if (doorAccess) lines.push({ label: m.labelDoorAccess, value: doorAccess });

  const shoot = formatShootDateDisplay(L.shootDate);
  if (shoot) lines.push({ label: m.labelShootDate, value: shoot });

  return lines;
}

export function hasGalleryListingContent(listing) {
  return buildGalleryListingDisplayLines(listing).length > 0;
}
