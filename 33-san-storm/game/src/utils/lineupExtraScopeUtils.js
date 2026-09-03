/**
 * 上阵编组 Extra 占用字段（与 backend lineupExtraService CARD_FIELDS 对齐）。
 * 形态同驻地 14 字段，无 city_id。
 */

export const LINEUP_EXTRA_OCCUPIED_INSTANCE_FIELDS = [
  'char1_card', 'char1_equipment_card', 'char1_title', 'char1_achievement', 'char1_treasure', 'char1_troop1', 'char1_troop2',
  'char2_card', 'char2_equipment_card', 'char2_title', 'char2_achievement', 'char2_treasure', 'char2_troop1', 'char2_troop2',
];

export function collectLineupExtraOccupiedInstanceIds(extraRows) {
  const ids = new Set();
  (extraRows || []).forEach((row) => {
    LINEUP_EXTRA_OCCUPIED_INSTANCE_FIELDS.forEach((f) => {
      if (row[f]) ids.add(row[f]);
    });
  });
  return ids;
}
