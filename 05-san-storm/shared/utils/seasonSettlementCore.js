/**
 * 赛季继承（结算）核心纯函数（ESM 前端副本 · 见 19-3 §4）
 *
 * ⚠️ 须与 seasonSettlementCore.cjs 保持同算法（后端用 .cjs，前端 import 本文件）。
 * 禁止 re-export .cjs（白屏 P0，见 san-storm-shared-cjs-esm-boundary.mdc）：本文件为纯 ESM 算法副本。
 *
 * @module shared/utils/seasonSettlementCore
 */

export const MAX_LEGENDARY_TROOPS = 10;
export const MAX_SELECTION_LIMIT_CAP = 10;

export const CARD_TYPES = Object.freeze([
  'troop',
  'character',
  'equipment',
  'title',
  'achievement',
  'treasure',
  'equipmentSet',
]);

const RARITY_FROM_SEQ_DIGIT = { 1: 'common', 2: 'rare', 3: 'epic', 4: 'legendary', 5: 'core' };
const KNOWN_RARITIES = new Set(['common', 'rare', 'epic', 'legendary', 'core']);

export const EQUIPMENT_SET_SLOT_KEYS = Object.freeze([
  'weapon_instance_id',
  'armor_instance_id',
  'accessory_1_instance_id',
  'accessory_2_instance_id',
]);

function pick(row, snake, camel) {
  if (row == null) return undefined;
  if (row[snake] !== undefined) return row[snake];
  return row[camel];
}
const cInstanceId = (r) => pick(r, 'instance_id', 'instanceId');
const cCardId = (r) => pick(r, 'card_id', 'cardId');
const cCardType = (r) => pick(r, 'card_type', 'cardType');
const cRarityCol = (r) => pick(r, 'rarity', 'rarity');
const cObtainedAt = (r) => pick(r, 'obtained_at', 'obtainedAt');
const cEquipmentSetData = (r) => pick(r, 'equipment_set_data', 'equipmentSetData');
const cBoundSet = (r) => pick(r, 'bound_equipment_set_instance_id', 'boundEquipmentSetInstanceId');
const cIsEquipped = (r) => pick(r, 'is_equipped', 'isEquipped');

export function rarityFromCardId(cardId) {
  const parts = String(cardId || '').trim().split('_');
  const seqStr = parts[parts.length - 1] || '';
  return RARITY_FROM_SEQ_DIGIT[seqStr.charAt(0)] || 'common';
}

export function resolveCardRarity(row) {
  const fromId = rarityFromCardId(cCardId(row));
  if (fromId && fromId !== 'common') return fromId;
  const col = String(cRarityCol(row) || '').toLowerCase();
  if (KNOWN_RARITIES.has(col)) return col;
  return fromId;
}

export function obtainedAtToTime(v) {
  if (v == null) return 0;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

export function seasonOrdinal(seasonId) {
  const id = String(seasonId || '').trim();
  let m = /^san_0_m([1-9]\d*)$/.exec(id);
  if (m) return Number(m[1]);
  m = /^san_([1-9]\d*)$/.exec(id);
  if (m) return Number(m[1]);
  return null;
}

/** 须与 seasonSettlementCore.cjs 同步 */
export function resolveCampaignConfigSeason(accountSeason) {
  const id = String(accountSeason || '').trim();
  if (/^san_0_m\d+$/.test(id)) return 'san_1';
  if (id) return id;
  return 'san_1';
}

export function computeSelectionLimits(fromSeason) {
  const ord = seasonOrdinal(fromSeason);
  if (ord == null) {
    throw Object.assign(new Error(`invalid fromSeason: ${fromSeason}`), { code: 'INVALID_SEASON' });
  }
  return {
    maxEquipmentSets: Math.min(ord, MAX_SELECTION_LIMIT_CAP),
    maxLegendaryTroops: MAX_LEGENDARY_TROOPS,
  };
}

export function parseEquipmentSetData(raw) {
  const empty = {
    display_name: null,
    weapon_instance_id: null,
    armor_instance_id: null,
    accessory_1_instance_id: null,
    accessory_2_instance_id: null,
  };
  if (!raw) return empty;
  let o = raw;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      return empty;
    }
  }
  const d = { ...empty, ...o };
  if (!d.display_name && o.displayName) d.display_name = o.displayName;
  if (!d.weapon_instance_id && o.weaponInstanceId) d.weapon_instance_id = o.weaponInstanceId;
  if (!d.armor_instance_id && o.armorInstanceId) d.armor_instance_id = o.armorInstanceId;
  if (!d.accessory_1_instance_id && o.accessory1InstanceId)
    d.accessory_1_instance_id = o.accessory1InstanceId;
  if (!d.accessory_2_instance_id && o.accessory2InstanceId)
    d.accessory_2_instance_id = o.accessory2InstanceId;
  return d;
}

export function isEquipmentSetDraft(equipmentSetData) {
  const n = parseEquipmentSetData(equipmentSetData).display_name;
  return n == null || String(n).trim() === '';
}

export function equipmentSetSlotInstanceIds(equipmentSetData) {
  const data = parseEquipmentSetData(equipmentSetData);
  return EQUIPMENT_SET_SLOT_KEYS.map((k) => data[k]).filter((x) => x != null && x !== '');
}

export function sortInstanceIdsForAutoSelect(rows) {
  return [...(rows || [])]
    .map((r) => ({
      instanceId: cInstanceId(r),
      cardId: String(cCardId(r) || ''),
      t: obtainedAtToTime(cObtainedAt(r)),
    }))
    .sort((a, b) => {
      if (a.cardId !== b.cardId) return a.cardId < b.cardId ? -1 : 1;
      if (a.t !== b.t) return a.t - b.t;
      const ai = String(a.instanceId || '');
      const bi = String(b.instanceId || '');
      return ai < bi ? -1 : ai > bi ? 1 : 0;
    })
    .map((x) => x.instanceId);
}

export function autoPickInstanceIds({ pool, maxCount }) {
  const ordered = sortInstanceIdsForAutoSelect(pool);
  const n = Math.max(0, Number(maxCount) || 0);
  return ordered.slice(0, n);
}

export function buildAutoInheritedPayload({ cards, items, seasonBadgeItemIds } = {}) {
  const rows = Array.isArray(cards) ? cards : [];
  const achievements = [];
  const titles = [];
  const treasures = [];
  const coreTroops = [];

  for (const r of rows) {
    const type = cCardType(r);
    if (type === 'achievement') achievements.push(r);
    else if (type === 'title') titles.push(r);
    else if (type === 'treasure') treasures.push(r);
    else if (type === 'troop' && resolveCardRarity(r) === 'core') coreTroops.push(r);
  }

  const badgeSet = new Set(
    seasonBadgeItemIds ? Array.from(seasonBadgeItemIds, (x) => String(x)) : []
  );
  const seasonBadgeItems = {};
  const itemsMap = items && typeof items === 'object' ? items : {};
  for (const [itemId, rawCount] of Object.entries(itemsMap)) {
    if (!badgeSet.has(String(itemId))) continue;
    const count = Number(rawCount) || 0;
    if (count > 0) seasonBadgeItems[itemId] = count;
  }

  return {
    achievementInstanceIds: sortInstanceIdsForAutoSelect(achievements),
    titleInstanceIds: sortInstanceIdsForAutoSelect(titles),
    treasureInstanceIds: sortInstanceIdsForAutoSelect(treasures),
    coreTroopInstanceIds: sortInstanceIdsForAutoSelect(coreTroops),
    seasonBadgeItems,
  };
}

export function listSelectableEquipmentSets(cards) {
  const rows = Array.isArray(cards) ? cards : [];
  const out = [];
  for (const r of rows) {
    if (cCardType(r) !== 'equipmentSet') continue;
    const data = parseEquipmentSetData(cEquipmentSetData(r));
    if (isEquipmentSetDraft(data)) continue;
    out.push({
      instanceId: cInstanceId(r),
      displayName: String(data.display_name || ''),
      equipmentInstanceIds: equipmentSetSlotInstanceIds(data),
    });
  }
  const order = sortInstanceIdsForAutoSelect(
    rows.filter(
      (r) => cCardType(r) === 'equipmentSet' && !isEquipmentSetDraft(cEquipmentSetData(r))
    )
  );
  const rank = new Map(order.map((id, i) => [id, i]));
  return out.sort((a, b) => (rank.get(a.instanceId) ?? 0) - (rank.get(b.instanceId) ?? 0));
}

export function listSelectableLegendaryTroops(cards) {
  const rows = (Array.isArray(cards) ? cards : []).filter(
    (r) => cCardType(r) === 'troop' && resolveCardRarity(r) === 'legendary'
  );
  const orderedIds = sortInstanceIdsForAutoSelect(rows);
  const byId = new Map(rows.map((r) => [cInstanceId(r), r]));
  return orderedIds.map((id) => ({ instanceId: id, cardId: String(cCardId(byId.get(id)) || '') }));
}

export function validatePlayerSelection({
  cards,
  selectedEquipmentSetInstanceIds = [],
  selectedLegendaryTroopInstanceIds = [],
  limits,
} = {}) {
  const errors = [];
  const rows = Array.isArray(cards) ? cards : [];
  const byInstance = new Map(rows.map((r) => [cInstanceId(r), r]));

  const eqSel = selectedEquipmentSetInstanceIds.map(String);
  const trSel = selectedLegendaryTroopInstanceIds.map(String);

  const allSel = [...eqSel, ...trSel];
  if (new Set(allSel).size !== allSel.length) {
    errors.push({ code: 'DUPLICATE_SELECTION' });
  }

  const maxEq = limits ? limits.maxEquipmentSets : MAX_SELECTION_LIMIT_CAP;
  const maxTr = limits ? limits.maxLegendaryTroops : MAX_LEGENDARY_TROOPS;
  if (eqSel.length > maxEq) errors.push({ code: 'EQUIPMENT_SET_LIMIT', detail: `${eqSel.length}/${maxEq}` });
  if (trSel.length > maxTr) errors.push({ code: 'LEGENDARY_TROOP_LIMIT', detail: `${trSel.length}/${maxTr}` });

  const referencedEquipment = new Map();

  for (const id of eqSel) {
    const row = byInstance.get(id);
    if (!row) {
      errors.push({ code: 'INVALID_INSTANCE_OWNER', detail: id });
      continue;
    }
    if (cCardType(row) !== 'equipmentSet') {
      errors.push({ code: 'INVALID_INSTANCE_OWNER', detail: `${id} not equipmentSet` });
      continue;
    }
    const data = parseEquipmentSetData(cEquipmentSetData(row));
    if (isEquipmentSetDraft(data)) {
      errors.push({ code: 'EQUIPMENT_SET_DRAFT', detail: id });
      continue;
    }
    const slotIds = equipmentSetSlotInstanceIds(data);
    for (const eqId of slotIds) {
      const eqRow = byInstance.get(eqId);
      if (!eqRow || cCardType(eqRow) !== 'equipment' || cBoundSet(eqRow) !== id) {
        errors.push({ code: 'EQUIPMENT_ORPHAN', detail: `${id}->${eqId}` });
        continue;
      }
      if (referencedEquipment.has(eqId)) {
        errors.push({ code: 'EQUIPMENT_ORPHAN', detail: `dup piece ${eqId}` });
      } else {
        referencedEquipment.set(eqId, id);
      }
    }
  }

  for (const id of trSel) {
    const row = byInstance.get(id);
    if (!row) {
      errors.push({ code: 'INVALID_INSTANCE_OWNER', detail: id });
      continue;
    }
    if (cCardType(row) !== 'troop' || resolveCardRarity(row) !== 'legendary') {
      errors.push({ code: 'INVALID_INSTANCE_OWNER', detail: `${id} not legendary troop` });
    }
  }

  return { ok: errors.length === 0, errors };
}

export function normalizeUnequippedRow(row) {
  const clone = { ...row };
  if ('is_equipped' in clone) clone.is_equipped = 0;
  if ('isEquipped' in clone) clone.isEquipped = false;
  if ('equipped_by' in clone) clone.equipped_by = null;
  if ('equippedBy' in clone) clone.equippedBy = null;
  if ('equipped_slot' in clone) clone.equipped_slot = null;
  if ('equippedSlot' in clone) clone.equippedSlot = null;
  return clone;
}

export function buildPlayerCardsSnapshot({
  cards,
  auto,
  selectedEquipmentSetInstanceIds = [],
  selectedLegendaryTroopInstanceIds = [],
} = {}) {
  const rows = Array.isArray(cards) ? cards : [];
  const byInstance = new Map(rows.map((r) => [String(cInstanceId(r)), r]));
  const wanted = new Set();

  const autoPayload = auto || {};
  for (const key of [
    'achievementInstanceIds',
    'titleInstanceIds',
    'treasureInstanceIds',
    'coreTroopInstanceIds',
  ]) {
    for (const id of autoPayload[key] || []) wanted.add(String(id));
  }

  for (const id of selectedLegendaryTroopInstanceIds) wanted.add(String(id));

  for (const setId of selectedEquipmentSetInstanceIds) {
    wanted.add(String(setId));
    const setRow = byInstance.get(String(setId));
    if (!setRow) continue;
    for (const eqId of equipmentSetSlotInstanceIds(cEquipmentSetData(setRow))) {
      wanted.add(String(eqId));
    }
  }

  const out = [];
  for (const id of wanted) {
    const row = byInstance.get(id);
    if (row) out.push(normalizeUnequippedRow(row));
  }
  return out.sort((a, b) => {
    const ai = String(cInstanceId(a) || '');
    const bi = String(cInstanceId(b) || '');
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  });
}

export function assertSnapshotApplyable(snapshotRows) {
  const rows = Array.isArray(snapshotRows) ? snapshotRows : [];
  const seen = new Set();
  const byInstance = new Map();
  for (const r of rows) {
    const id = String(cInstanceId(r) || '');
    if (!id) throw err('SNAPSHOT_MISSING_INSTANCE_ID');
    if (seen.has(id)) throw err('SNAPSHOT_DUPLICATE_INSTANCE', id);
    seen.add(id);
    byInstance.set(id, r);
    if (!CARD_TYPES.includes(cCardType(r))) throw err('SNAPSHOT_BAD_CARD_TYPE', `${id}:${cCardType(r)}`);
    if (cIsEquipped(r)) throw err('SNAPSHOT_ROW_EQUIPPED', id);
  }
  for (const r of rows) {
    if (cCardType(r) !== 'equipmentSet') continue;
    const setId = String(cInstanceId(r));
    for (const eqId of equipmentSetSlotInstanceIds(cEquipmentSetData(r))) {
      const eqRow = byInstance.get(String(eqId));
      if (!eqRow || cCardType(eqRow) !== 'equipment' || String(cBoundSet(eqRow)) !== setId) {
        throw err('SNAPSHOT_EQUIPMENT_NOT_CLOSED', `${setId}->${eqId}`);
      }
    }
  }
}

function err(code, detail) {
  return Object.assign(new Error(detail ? `${code}: ${detail}` : code), { code });
}
