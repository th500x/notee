/**
 * Garrison lineup scope: instance fields (snake_case API rows).
 * Keep in sync with backend `garrisonService` CARD_FIELDS.
 * 驻地编组仅挂主城（`players.main_city_id`）；不再有多城上限。
 */

export const GARRISON_OCCUPIED_INSTANCE_FIELDS = [
  'char1_card', 'char1_equipment_card', 'char1_title', 'char1_achievement', 'char1_treasure', 'char1_troop1', 'char1_troop2',
  'char2_card', 'char2_equipment_card', 'char2_title', 'char2_achievement', 'char2_treasure', 'char2_troop1', 'char2_troop2',
];

export function collectGarrisonOccupiedInstanceIds(garrisonRows) {
  const ids = new Set();
  (garrisonRows || []).forEach((g) => {
    GARRISON_OCCUPIED_INSTANCE_FIELDS.forEach((f) => {
      if (g[f]) ids.add(g[f]);
    });
  });
  return ids;
}

/**
 * Cities that already have at least one non-null card slot in player_garrison (any pool).
 * 现网仅主城应有行；工具仍按行扫描。
 * @param {object[]} garrisonRows rows from GET /garrisons/:playerId (snake_case)
 * @returns {Set<string>}
 */
export function getConfiguredGarrisonCityIds(garrisonRows) {
  const cities = new Set();
  (garrisonRows || []).forEach((g) => {
    const cid = g?.city_id != null ? String(g.city_id) : '';
    if (!cid) return;
    const any = GARRISON_OCCUPIED_INSTANCE_FIELDS.some((f) => !!g[f]);
    if (any) cities.add(cid);
  });
  return cities;
}
