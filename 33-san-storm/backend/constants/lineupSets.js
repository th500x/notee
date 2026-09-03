/**
 * 双将领编组套表常量（驻地 / Extra 同行结构）
 * @module backend/constants/lineupSets
 */

const TABLE = 'player_lineup_sets';
const SCOPE_GARRISON = 'garrison';
const SCOPE_EXTRA = 'extra';
/** Extra 行的 city_id 哨兵（禁止写真实城） */
const EXTRA_CITY_ID = '';

const CARD_FIELDS = [
  'char1_card', 'char1_equipment_card', 'char1_title', 'char1_achievement', 'char1_treasure', 'char1_troop1', 'char1_troop2',
  'char2_card', 'char2_equipment_card', 'char2_title', 'char2_achievement', 'char2_treasure', 'char2_troop1', 'char2_troop2',
];

/**
 * 将 DB 行映射为驻地 API 兼容形状（lineup_slot → garrison_slot）
 * @param {object|null} row
 */
function mapGarrisonApiRow(row) {
  if (!row) return row;
  const out = { ...row };
  if (out.lineup_slot != null && out.garrison_slot == null) {
    out.garrison_slot = out.lineup_slot;
  }
  return out;
}

function mapGarrisonApiRows(rows) {
  return (rows || []).map(mapGarrisonApiRow);
}

module.exports = {
  TABLE,
  SCOPE_GARRISON,
  SCOPE_EXTRA,
  EXTRA_CITY_ID,
  CARD_FIELDS,
  mapGarrisonApiRow,
  mapGarrisonApiRows,
};
