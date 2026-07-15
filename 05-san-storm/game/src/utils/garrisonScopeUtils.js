/**
 * Garrison lineup scope: instance fields (snake_case API rows) and city cap helpers.
 * Keep in sync with backend `garrisonService` CARD_FIELDS.
 */

export const GARRISON_OCCUPIED_INSTANCE_FIELDS = [
  'char1_card', 'char1_equipment_card', 'char1_title', 'char1_achievement', 'char1_treasure', 'char1_troop1', 'char1_troop2',
  'char2_card', 'char2_equipment_card', 'char2_title', 'char2_achievement', 'char2_treasure', 'char2_troop1', 'char2_troop2',
];

/** Max distinct cities where the player may assign any card to garrison (product S1). */
export const MAX_GARRISON_CONFIGURED_CITIES = 5;

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
