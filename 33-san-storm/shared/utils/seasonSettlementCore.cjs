/**
 * 赛季继承（结算）核心纯函数（赛季继承 Phase 0.2 · 见 19-3 §4）
 *
 * 全部为纯函数：不读库、不依赖时间/随机，便于单测与前后端复用。
 * 后端 require('./seasonSettlementCore.cjs')；前端 import './seasonSettlementCore.js'（同算法副本）。
 * ⚠️ 修改算法时必须同步更新 seasonSettlementCore.js。
 *
 * 稀有度解析与 backend/utils/configCardId.js#resolveRarityFromConfigId 同算法
 * （card_id 末段首位数字：1 common / 2 rare / 3 epic / 4 legendary / 5 core）。
 *
 * @module shared/utils/seasonSettlementCore
 */

const { getMaxBattleCount } = require('./troopMaxBattleCount.cjs');

const MAX_LEGENDARY_TROOPS = 10;
const MAX_SELECTION_LIMIT_CAP = 10;

const CARD_TYPES = Object.freeze([
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

const EQUIPMENT_SET_SLOT_KEYS = Object.freeze([
  'weapon_instance_id',
  'armor_instance_id',
  'accessory_1_instance_id',
  'accessory_2_instance_id',
]);

/** 兼容 snake_case（DB 行）与 camelCase（API/前端）两种来源 */
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

/** card_id 末段首位数字 → 稀有度（与 configCardId.js 同算法） */
function rarityFromCardId(cardId) {
  const parts = String(cardId || '').trim().split('_');
  const seqStr = parts[parts.length - 1] || '';
  return RARITY_FROM_SEQ_DIGIT[seqStr.charAt(0)] || 'common';
}

/**
 * 解析一张卡的稀有度：优先 card_id（rewardService 注释口径，最可靠），
 * 仅当 card_id 解析不出已知稀有度时回退到 rarity 列。
 */
function resolveCardRarity(row) {
  const fromId = rarityFromCardId(cCardId(row));
  if (fromId && fromId !== 'common') return fromId;
  const col = String(cRarityCol(row) || '').toLowerCase();
  if (KNOWN_RARITIES.has(col)) return col;
  return fromId; // 'common'
}

/** obtained_at → 可比较时间戳；null/非法视为最早（0），保证排序确定性（见 19-3 §4.6） */
function obtainedAtToTime(v) {
  if (v == null) return 0;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * 赛季序号：san_0_m1..m5 → 1..5；san_1/san_2/... → 1/2/...；非法 → null（调用方早失败）
 * @param {string} seasonId
 * @returns {number|null}
 */
function seasonOrdinal(seasonId) {
  const id = String(seasonId || '').trim();
  let m = /^san_0_m([1-9]\d*)$/.exec(id);
  if (m) return Number(m[1]);
  m = /^san_([1-9]\d*)$/.exec(id);
  if (m) return Number(m[1]);
  return null;
}

/**
 * 账号 current_season → 读 config_* / cities 等世界配置用的 season 键。
 * san_0_m1..mN 为运营元赛季，世界内容仍走 san_1；正式赛季 san_1/san_2/... 直接用自身。
 * @param {string|null|undefined} accountSeason
 * @returns {string}
 */
function resolveWorldConfigSeason(accountSeason) {
  const id = String(accountSeason || '').trim();
  if (/^san_0_m\d+$/.test(id)) return 'san_1';
  if (id) return id;
  return 'san_1';
}

/**
 * 选择上限：maxEquipmentSets = min(seasonOrdinal, 10)；maxLegendaryTroops = 10
 * @param {string} fromSeason
 * @returns {{ maxEquipmentSets: number, maxLegendaryTroops: number }}
 */
function computeSelectionLimits(fromSeason) {
  const ord = seasonOrdinal(fromSeason);
  if (ord == null) {
    throw Object.assign(new Error(`invalid fromSeason: ${fromSeason}`), {
      code: 'INVALID_SEASON',
    });
  }
  return {
    maxEquipmentSets: Math.min(ord, MAX_SELECTION_LIMIT_CAP),
    maxLegendaryTroops: MAX_LEGENDARY_TROOPS,
  };
}

/** 套装四槽引用的装备 instance_id（去空） */
function equipmentSetSlotInstanceIds(equipmentSetData) {
  const data = parseEquipmentSetData(equipmentSetData);
  return EQUIPMENT_SET_SLOT_KEYS.map((k) => data[k]).filter((x) => x != null && x !== '');
}

/** 解析 equipment_set_data（对象或 JSON 字符串）；与 equipmentSetService.parseSetData 同语义 */
function parseEquipmentSetData(raw) {
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

/** 套装是否为草稿（display_name 为空）；与 equipmentSetService.isDraftData 同语义 */
function isEquipmentSetDraft(equipmentSetData) {
  const n = parseEquipmentSetData(equipmentSetData).display_name;
  return n == null || String(n).trim() === '';
}

/**
 * 自动排序：card_id ASC → obtained_at ASC（null 视为最早）→ instance_id ASC
 * @param {object[]} rows
 * @returns {string[]} 排序后的 instance_id 列表
 */
function sortInstanceIdsForAutoSelect(rows) {
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

/**
 * 超限池自动取前 maxCount 个（方式2关服自动封档用）
 * @param {{ pool: object[], maxCount: number }} args
 * @returns {string[]}
 */
function autoPickInstanceIds({ pool, maxCount }) {
  const ordered = sortInstanceIdsForAutoSelect(pool);
  const n = Math.max(0, Number(maxCount) || 0);
  return ordered.slice(0, n);
}

/**
 * 自动继承内容（成就/称号/宝物/core 部队/赛季徽章）
 * @param {{ cards: object[], items?: object, seasonBadgeItemIds?: Iterable<string> }} args
 * @returns {{ achievementInstanceIds: string[], titleInstanceIds: string[], treasureInstanceIds: string[], coreTroopInstanceIds: string[], seasonBadgeItems: Record<string, number> }}
 */
function buildAutoInheritedPayload({ cards, items, seasonBadgeItemIds } = {}) {
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

/**
 * 可选装备套装清单（非草稿）
 * @param {object[]} cards
 * @returns {{ instanceId: string, displayName: string, equipmentInstanceIds: string[] }[]}
 */
function listSelectableEquipmentSets(cards) {
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

/**
 * 可选橙（legendary）部队清单
 * @param {object[]} cards
 * @returns {{ instanceId: string, cardId: string }[]}
 */
function listSelectableLegendaryTroops(cards) {
  const rows = (Array.isArray(cards) ? cards : []).filter(
    (r) => cCardType(r) === 'troop' && resolveCardRarity(r) === 'legendary'
  );
  const orderedIds = sortInstanceIdsForAutoSelect(rows);
  const byId = new Map(rows.map((r) => [cInstanceId(r), r]));
  return orderedIds.map((id) => ({ instanceId: id, cardId: String(cCardId(byId.get(id)) || '') }));
}

/**
 * 校验玩家选择（确定性、无副作用）
 * @returns {{ ok: boolean, errors: { code: string, detail?: string }[] }}
 */
function validatePlayerSelection({
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

  // 重复 id（含跨类）
  const allSel = [...eqSel, ...trSel];
  if (new Set(allSel).size !== allSel.length) {
    errors.push({ code: 'DUPLICATE_SELECTION' });
  }

  // 数量上限
  const maxEq = limits ? limits.maxEquipmentSets : MAX_SELECTION_LIMIT_CAP;
  const maxTr = limits ? limits.maxLegendaryTroops : MAX_LEGENDARY_TROOPS;
  if (eqSel.length > maxEq) errors.push({ code: 'EQUIPMENT_SET_LIMIT', detail: `${eqSel.length}/${maxEq}` });
  if (trSel.length > maxTr) errors.push({ code: 'LEGENDARY_TROOP_LIMIT', detail: `${trSel.length}/${maxTr}` });

  // 所有装备件被多个所选套装重复引用检测用
  const referencedEquipment = new Map(); // equipmentInstanceId -> setInstanceId

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
      // 双向闭合：装备件存在、是 equipment、bound 指回本套装
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

/** 把一张行规整为「未编组」态（新赛季无编组）；保留套装内部闭合 bound 指针 */
function normalizeUnequippedRow(row) {
  const clone = { ...row };
  if ('is_equipped' in clone) clone.is_equipped = 0;
  if ('isEquipped' in clone) clone.isEquipped = false;
  if ('equipped_by' in clone) clone.equipped_by = null;
  if ('equippedBy' in clone) clone.equippedBy = null;
  if ('equipped_slot' in clone) clone.equipped_slot = null;
  if ('equippedSlot' in clone) clone.equippedSlot = null;
  return clone;
}

/**
 * 跨季继承部队卡：按当前稀有度表重写 max_battle_count，battle_count 清零。
 * 老兵 lifetime_* / veteran_* 原样保留。非部队行不改动。
 */
function normalizeInheritedTroopDurability(row) {
  if (!row || cCardType(row) !== 'troop') return row;
  const clone = { ...row };
  const max = getMaxBattleCount(resolveCardRarity(clone));
  clone.max_battle_count = max;
  clone.battle_count = 0;
  if ('maxBattleCount' in clone) clone.maxBattleCount = max;
  if ('battleCount' in clone) clone.battleCount = 0;
  return clone;
}

/**
 * 组装封档卡牌行快照（完整行，供关服后 re-INSERT）。
 * 收集：auto 全部 instance + 所选套装 + 套装绑定的 equipment 件 + 所选 legendary 部队。
 * 季徽章不在卡表（在 players.items），不进此快照。
 * 部队行会写入新赛季耐久：max 按稀有度表、battle_count=0。
 * @returns {object[]} 规整后的完整行数组（去重，按 instance_id 稳定排序）
 */
function buildPlayerCardsSnapshot({
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
    if (row) out.push(normalizeInheritedTroopDurability(normalizeUnequippedRow(row)));
  }
  return out.sort((a, b) => {
    const ai = String(cInstanceId(a) || '');
    const bi = String(cInstanceId(b) || '');
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  });
}

/**
 * 发放前再验快照可应用性；违规即 throw（fail-closed）。
 * @param {object[]} snapshotRows
 */
function assertSnapshotApplyable(snapshotRows) {
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
  // 套装闭合：所引用装备件须在快照内、为 equipment、bound 指回本套装
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

module.exports = {
  MAX_LEGENDARY_TROOPS,
  MAX_SELECTION_LIMIT_CAP,
  CARD_TYPES,
  EQUIPMENT_SET_SLOT_KEYS,
  rarityFromCardId,
  resolveCardRarity,
  obtainedAtToTime,
  seasonOrdinal,
  resolveWorldConfigSeason,
  computeSelectionLimits,
  parseEquipmentSetData,
  isEquipmentSetDraft,
  equipmentSetSlotInstanceIds,
  sortInstanceIdsForAutoSelect,
  autoPickInstanceIds,
  buildAutoInheritedPayload,
  listSelectableEquipmentSets,
  listSelectableLegendaryTroops,
  validatePlayerSelection,
  normalizeUnequippedRow,
  normalizeInheritedTroopDurability,
  buildPlayerCardsSnapshot,
  assertSnapshotApplyable,
};
