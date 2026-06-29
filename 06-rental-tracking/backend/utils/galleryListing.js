/**
 * 账目图库 — 房源说明（服务端归一化）
 */

const { sanitizeIsoDateField } = require('./accountingDates');

function emptyGalleryListing() {
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

function normalizeGalleryListing(raw) {
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

module.exports = {
  emptyGalleryListing,
  normalizeGalleryListing
};
