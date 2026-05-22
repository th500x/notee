/**
 * 税费单 JSON 模型（与 backend/utils/taxSheet.js 结构一致）
 */

export function newTaxRowId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `tax-r-${crypto.randomUUID()}`;
  }
  return `tax-r-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyTaxDetailFields() {
  return {
    roomNo: '',
    condo: '',
    owner: '',
    passport: '',
    taxNo: '',
    note: ''
  };
}

export function emptyTaxRow(room = '') {
  return {
    id: newTaxRowId(),
    room: typeof room === 'string' ? room : '',
    sourceRentRowId: '',
    ...emptyTaxDetailFields()
  };
}

export function taxRowsFromAccountingRentRows(rentRows) {
  const rows = Array.isArray(rentRows) ? rentRows : [];
  return rows.map((r) => ({
    id: newTaxRowId(),
    room: typeof r.room === 'string' ? r.room : '',
    sourceRentRowId: typeof r.id === 'string' ? r.id : '',
    ...emptyTaxDetailFields()
  }));
}

export function defaultTaxSheet(sourceAccountingProjectId, rentRows, sourceName = '') {
  return {
    sourceAccountingProjectId: sourceAccountingProjectId || '',
    sourceAccountingProjectName: typeof sourceName === 'string' ? sourceName : '',
    rows: taxRowsFromAccountingRentRows(rentRows)
  };
}

function normalizeTaxRow(raw, index) {
  const o = typeof raw === 'object' && raw !== null ? raw : {};
  const id =
    typeof o.id === 'string' && o.id.trim()
      ? o.id.trim()
      : `${newTaxRowId()}${Number.isFinite(index) ? `-${index}` : ''}`;
  return {
    id,
    room: typeof o.room === 'string' ? o.room : '',
    sourceRentRowId: typeof o.sourceRentRowId === 'string' ? o.sourceRentRowId : '',
    roomNo: typeof o.roomNo === 'string' ? o.roomNo : '',
    condo: typeof o.condo === 'string' ? o.condo : '',
    owner: typeof o.owner === 'string' ? o.owner : '',
    passport: typeof o.passport === 'string' ? o.passport : '',
    taxNo: typeof o.taxNo === 'string' ? o.taxNo : '',
    note: typeof o.note === 'string' ? o.note : ''
  };
}

export function normalizeTaxSheet(raw) {
  const obj = typeof raw === 'object' && raw !== null ? raw : {};
  const rowsIn = Array.isArray(obj.rows) ? obj.rows : [];
  return {
    sourceAccountingProjectId:
      typeof obj.sourceAccountingProjectId === 'string' ? obj.sourceAccountingProjectId : '',
    sourceAccountingProjectName:
      typeof obj.sourceAccountingProjectName === 'string' ? obj.sourceAccountingProjectName : '',
    rows: rowsIn.map((r, i) => normalizeTaxRow(r, i))
  };
}
