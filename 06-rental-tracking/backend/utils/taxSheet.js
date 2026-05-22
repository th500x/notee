/**
 * 税费单 JSON：服务端默认值与归一化（与前端 taxSheetModel 结构一致）
 */

const { normalizeAccountingSheet } = require('./accountingSheet');
const { parseJSON } = require('./jsonParser');

function newTaxRowId() {
  return `tax-r-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function emptyTaxDetailFields() {
  return {
    roomNo: '',
    condo: '',
    owner: '',
    passport: '',
    taxNo: '',
    note: ''
  };
}

function taxRowsFromAccountingRentRows(rentRows) {
  const rows = Array.isArray(rentRows) ? rentRows : [];
  return rows.map((r) => ({
    id: newTaxRowId(),
    room: typeof r.room === 'string' ? r.room : '',
    sourceRentRowId: typeof r.id === 'string' ? r.id : '',
    ...emptyTaxDetailFields()
  }));
}

function defaultTaxSheet(sourceAccountingProjectId, rentRows, sourceName) {
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
      : newTaxRowId() + (Number.isFinite(index) ? `-${index}` : '');
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

function normalizeTaxSheet(raw) {
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

/**
 * 从账目单项目生成初始税费表（创建 tax 项目时调用）
 */
function buildTaxSheetFromAccountingRow(accountingRow) {
  if (!accountingRow) {
    throw new Error('房源来源账目单不存在');
  }
  const kind = accountingRow.project_kind || 'rental';
  if (kind !== 'accounting') {
    throw new Error('房源来源必须是账目单项目');
  }
  const sheet = normalizeAccountingSheet(parseJSON(accountingRow.accounting_sheet, null));
  return defaultTaxSheet(accountingRow.id, sheet.rentRows, accountingRow.name);
}

module.exports = {
  defaultTaxSheet,
  normalizeTaxSheet,
  buildTaxSheetFromAccountingRow,
  taxRowsFromAccountingRentRows
};
