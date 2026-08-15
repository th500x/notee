/**
 * 账目图库 — 房源说明（服务端归一化）
 */

const { sanitizeIsoDateField } = require('./accountingDates');

const GALLERY_GPS_URL_MAX = 500;

function emptyGalleryListing() {
  return {
    gpsUrl: '',
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

function normalizeGalleryGpsUrl(raw) {
  let v = trimField(raw, GALLERY_GPS_URL_MAX);
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) {
    v = `https://${v}`;
  }
  return v.slice(0, GALLERY_GPS_URL_MAX);
}

function normalizeGalleryListing(raw) {
  const base = emptyGalleryListing();
  if (!raw || typeof raw !== 'object') return base;
  return {
    gpsUrl: normalizeGalleryGpsUrl(raw.gpsUrl),
    condo: trimField(raw.condo, 100),
    building: trimField(raw.building, 100),
    occupancy: normalizeOccupancy(raw.occupancy),
    rentBaht: trimField(raw.rentBaht, 50),
    depositBaht: trimField(raw.depositBaht, 50),
    areaSqm: trimField(raw.areaSqm, 50),
    layout: normalizeLayout(raw.layout),
    electricFee: trimField(raw.electricFee, 100),
    waterFee: trimField(raw.waterFee, 100),
    tvInch: trimField(raw.tvInch, 20),
    tvType: normalizeTvType(raw.tvType),
    internet: normalizeInternet(raw.internet),
    doorAccess: trimField(raw.doorAccess, 100),
    shootDate: sanitizeIsoDateField(typeof raw.shootDate === 'string' ? raw.shootDate : '')
  };
}

module.exports = {
  emptyGalleryListing,
  normalizeGalleryListing
};
