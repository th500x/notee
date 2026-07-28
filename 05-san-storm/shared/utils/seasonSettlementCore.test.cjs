const test = require('node:test');
const assert = require('node:assert/strict');
const {
  seasonOrdinal,
  computeSelectionLimits,
  rarityFromCardId,
  resolveCardRarity,
  obtainedAtToTime,
  sortInstanceIdsForAutoSelect,
  autoPickInstanceIds,
  buildAutoInheritedPayload,
  listSelectableEquipmentSets,
  listSelectableLegendaryTroops,
  validatePlayerSelection,
  buildPlayerCardsSnapshot,
  assertSnapshotApplyable,
} = require('./seasonSettlementCore.cjs');

// ---- helpers ----
const troop = (instanceId, cardId, obtainedAt = '2026-01-01 00:00:00', extra = {}) => ({
  instance_id: instanceId,
  card_id: cardId,
  card_type: 'troop',
  obtained_at: obtainedAt,
  ...extra,
});
const card = (instanceId, cardType, cardId, extra = {}) => ({
  instance_id: instanceId,
  card_id: cardId,
  card_type: cardType,
  obtained_at: '2026-01-01 00:00:00',
  ...extra,
});
const equip = (instanceId, boundSetId) => ({
  instance_id: instanceId,
  card_id: 'san_1_equip_1_2001',
  card_type: 'equipment',
  obtained_at: '2026-01-01 00:00:00',
  bound_equipment_set_instance_id: boundSetId,
});
const eqSet = (instanceId, displayName, slots) => ({
  instance_id: instanceId,
  card_id: 'san_1_equipment_set_shell',
  card_type: 'equipmentSet',
  obtained_at: '2026-01-01 00:00:00',
  equipment_set_data: {
    display_name: displayName,
    weapon_instance_id: slots[0] || null,
    armor_instance_id: slots[1] || null,
    accessory_1_instance_id: slots[2] || null,
    accessory_2_instance_id: slots[3] || null,
  },
});

// ---- seasonOrdinal ----
test('seasonOrdinal maps test and formal seasons', () => {
  assert.equal(seasonOrdinal('san_0_m1'), 1);
  assert.equal(seasonOrdinal('san_0_m5'), 5);
  assert.equal(seasonOrdinal('san_0_m12'), 12);
  assert.equal(seasonOrdinal('san_1'), 1);
  assert.equal(seasonOrdinal('san_2'), 2);
  assert.equal(seasonOrdinal('san_10'), 10);
  assert.equal(seasonOrdinal('san_0'), null);
  assert.equal(seasonOrdinal('san_0_m0'), null);
  assert.equal(seasonOrdinal('garbage'), null);
  assert.equal(seasonOrdinal(''), null);
  assert.equal(seasonOrdinal(null), null);
});

test('resolveCampaignConfigSeason maps san_0_m* to san_1 world config', () => {
  const { resolveCampaignConfigSeason } = require('./seasonSettlementCore.cjs');
  assert.equal(resolveCampaignConfigSeason('san_0_m1'), 'san_1');
  assert.equal(resolveCampaignConfigSeason('san_0_m2'), 'san_1');
  assert.equal(resolveCampaignConfigSeason('san_0_m12'), 'san_1');
  assert.equal(resolveCampaignConfigSeason('san_2'), 'san_2');
  assert.equal(resolveCampaignConfigSeason(null), 'san_1');
  assert.equal(resolveCampaignConfigSeason(''), 'san_1');
});

// ---- computeSelectionLimits ----
test('computeSelectionLimits caps equipment sets at 10, legendary always 10', () => {
  assert.deepEqual(computeSelectionLimits('san_0_m1'), { maxEquipmentSets: 1, maxLegendaryTroops: 10 });
  assert.deepEqual(computeSelectionLimits('san_0_m5'), { maxEquipmentSets: 5, maxLegendaryTroops: 10 });
  assert.deepEqual(computeSelectionLimits('san_0_m12'), { maxEquipmentSets: 10, maxLegendaryTroops: 10 });
  assert.deepEqual(computeSelectionLimits('san_3'), { maxEquipmentSets: 3, maxLegendaryTroops: 10 });
});

test('computeSelectionLimits throws on invalid season', () => {
  assert.throws(() => computeSelectionLimits('san_0'), /invalid fromSeason/);
});

// ---- rarity ----
test('rarityFromCardId reads last segment first digit', () => {
  assert.equal(rarityFromCardId('san_1_troop_1001'), 'common');
  assert.equal(rarityFromCardId('san_1_troop_4001'), 'legendary');
  assert.equal(rarityFromCardId('san_1_troop_5001'), 'core');
});

test('resolveCardRarity prefers card_id, falls back to rarity column', () => {
  assert.equal(resolveCardRarity({ card_id: 'san_1_troop_5001' }), 'core');
  // card_id resolves to common -> fall back to rarity column when valid
  assert.equal(resolveCardRarity({ card_id: 'x', rarity: 'legendary' }), 'legendary');
  assert.equal(resolveCardRarity({ card_id: 'x', rarity: 'bogus' }), 'common');
});

// ---- obtainedAtToTime ----
test('obtainedAtToTime treats null/invalid as earliest', () => {
  assert.equal(obtainedAtToTime(null), 0);
  assert.equal(obtainedAtToTime('not-a-date'), 0);
  assert.ok(obtainedAtToTime('2026-01-01 00:00:00') > 0);
});

// ---- sorting ----
test('sortInstanceIdsForAutoSelect: card_id asc, obtained_at asc, instance_id tiebreak', () => {
  const rows = [
    troop('iZ', 'san_1_troop_4002', '2026-03-01 00:00:00'),
    troop('iA', 'san_1_troop_4001', '2026-02-01 00:00:00'),
    troop('iB', 'san_1_troop_4001', '2026-01-01 00:00:00'),
    troop('iC', 'san_1_troop_4001', '2026-01-01 00:00:00'), // same card_id+time -> instance tiebreak vs iB
  ];
  assert.deepEqual(sortInstanceIdsForAutoSelect(rows), ['iB', 'iC', 'iA', 'iZ']);
});

test('sortInstanceIdsForAutoSelect: null obtained_at sorts earliest deterministically', () => {
  const rows = [
    troop('later', 'san_1_troop_4001', '2026-05-01 00:00:00'),
    troop('nullA', 'san_1_troop_4001', null),
    troop('nullB', 'san_1_troop_4001', null),
  ];
  assert.deepEqual(sortInstanceIdsForAutoSelect(rows), ['nullA', 'nullB', 'later']);
});

// ---- autoPick ----
test('autoPickInstanceIds picks first maxCount after deterministic sort', () => {
  const pool = [];
  for (let i = 11; i >= 1; i--) {
    pool.push(troop(`t${i}`, `san_1_troop_40${String(i).padStart(2, '0')}`));
  }
  const picked = autoPickInstanceIds({ pool, maxCount: 10 });
  assert.equal(picked.length, 10);
  // smallest 10 card_ids: 4001..4010 -> t1..t10
  assert.deepEqual(picked, ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10']);
});

// ---- auto inherited ----
test('buildAutoInheritedPayload classifies and filters badges', () => {
  const cards = [
    card('a1', 'achievement', 'san_1_achi_1001'),
    card('t1', 'title', 'san_1_title_1001'),
    card('tr1', 'treasure', 'san_1_treasure_1001'),
    troop('core1', 'san_1_troop_5001'),
    troop('leg1', 'san_1_troop_4001'), // legendary -> NOT auto
    card('ch1', 'character', 'san_1_char_4001'), // excluded
  ];
  const out = buildAutoInheritedPayload({
    cards,
    items: { item_x_badge: 2, item_y_badge: 0, item_potion: 5 },
    seasonBadgeItemIds: ['item_x_badge', 'item_y_badge'],
  });
  assert.deepEqual(out.achievementInstanceIds, ['a1']);
  assert.deepEqual(out.titleInstanceIds, ['t1']);
  assert.deepEqual(out.treasureInstanceIds, ['tr1']);
  assert.deepEqual(out.coreTroopInstanceIds, ['core1']);
  assert.deepEqual(out.seasonBadgeItems, { item_x_badge: 2 }); // y filtered (count 0), potion filtered (not badge)
});

// ---- selectable lists ----
test('listSelectableEquipmentSets excludes drafts', () => {
  const cards = [
    eqSet('eset_done', 'My Set', ['w1', 'a1', 'c1', 'c2']),
    eqSet('eset_draft', '', ['w2', null, null, null]),
  ];
  const sets = listSelectableEquipmentSets(cards);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].instanceId, 'eset_done');
  assert.deepEqual(sets[0].equipmentInstanceIds, ['w1', 'a1', 'c1', 'c2']);
});

test('listSelectableLegendaryTroops returns only legendary, sorted', () => {
  const cards = [
    troop('leg2', 'san_1_troop_4002'),
    troop('leg1', 'san_1_troop_4001'),
    troop('core1', 'san_1_troop_5001'),
    troop('com1', 'san_1_troop_1001'),
  ];
  const legs = listSelectableLegendaryTroops(cards);
  assert.deepEqual(legs.map((l) => l.instanceId), ['leg1', 'leg2']);
});

// ---- validatePlayerSelection ----
function fixtureWithSet() {
  return [
    eqSet('eset_1', 'Set A', ['eq_w', 'eq_a', 'eq_c1', 'eq_c2']),
    equip('eq_w', 'eset_1'),
    equip('eq_a', 'eset_1'),
    equip('eq_c1', 'eset_1'),
    equip('eq_c2', 'eset_1'),
    troop('leg1', 'san_1_troop_4001'),
    troop('leg2', 'san_1_troop_4002'),
  ];
}

test('validatePlayerSelection: valid selection ok', () => {
  const res = validatePlayerSelection({
    cards: fixtureWithSet(),
    selectedEquipmentSetInstanceIds: ['eset_1'],
    selectedLegendaryTroopInstanceIds: ['leg1', 'leg2'],
    limits: { maxEquipmentSets: 1, maxLegendaryTroops: 10 },
  });
  assert.equal(res.ok, true, JSON.stringify(res.errors));
});

test('validatePlayerSelection: over equipment-set limit', () => {
  const cards = [
    eqSet('eset_1', 'A', ['eq_w', 'eq_a', 'eq_c1', 'eq_c2']),
    equip('eq_w', 'eset_1'), equip('eq_a', 'eset_1'), equip('eq_c1', 'eset_1'), equip('eq_c2', 'eset_1'),
    eqSet('eset_2', 'B', ['eq_w2', 'eq_a2', 'eq_c12', 'eq_c22']),
    equip('eq_w2', 'eset_2'), equip('eq_a2', 'eset_2'), equip('eq_c12', 'eset_2'), equip('eq_c22', 'eset_2'),
  ];
  const res = validatePlayerSelection({
    cards,
    selectedEquipmentSetInstanceIds: ['eset_1', 'eset_2'],
    limits: { maxEquipmentSets: 1, maxLegendaryTroops: 10 },
  });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'EQUIPMENT_SET_LIMIT'));
});

test('validatePlayerSelection: over legendary limit', () => {
  const cards = [];
  const ids = [];
  for (let i = 1; i <= 11; i++) {
    cards.push(troop(`l${i}`, `san_1_troop_40${String(i).padStart(2, '0')}`));
    ids.push(`l${i}`);
  }
  const res = validatePlayerSelection({
    cards,
    selectedLegendaryTroopInstanceIds: ids,
    limits: { maxEquipmentSets: 1, maxLegendaryTroops: 10 },
  });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'LEGENDARY_TROOP_LIMIT'));
});

test('validatePlayerSelection: draft set rejected', () => {
  const cards = [eqSet('eset_draft', '', ['eq_w', null, null, null]), equip('eq_w', 'eset_draft')];
  const res = validatePlayerSelection({
    cards,
    selectedEquipmentSetInstanceIds: ['eset_draft'],
    limits: { maxEquipmentSets: 5, maxLegendaryTroops: 10 },
  });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'EQUIPMENT_SET_DRAFT'));
});

test('validatePlayerSelection: equipment orphan (bound mismatch)', () => {
  const cards = [
    eqSet('eset_1', 'A', ['eq_w', 'eq_a', 'eq_c1', 'eq_c2']),
    equip('eq_w', 'eset_OTHER'), // bound to wrong set
    equip('eq_a', 'eset_1'), equip('eq_c1', 'eset_1'), equip('eq_c2', 'eset_1'),
  ];
  const res = validatePlayerSelection({
    cards,
    selectedEquipmentSetInstanceIds: ['eset_1'],
    limits: { maxEquipmentSets: 5, maxLegendaryTroops: 10 },
  });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'EQUIPMENT_ORPHAN'));
});

test('validatePlayerSelection: not owned / wrong type', () => {
  const res = validatePlayerSelection({
    cards: fixtureWithSet(),
    selectedLegendaryTroopInstanceIds: ['nope', 'eq_w'],
    limits: { maxEquipmentSets: 1, maxLegendaryTroops: 10 },
  });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'INVALID_INSTANCE_OWNER'));
});

test('validatePlayerSelection: duplicate selection', () => {
  const res = validatePlayerSelection({
    cards: fixtureWithSet(),
    selectedLegendaryTroopInstanceIds: ['leg1', 'leg1'],
    limits: { maxEquipmentSets: 1, maxLegendaryTroops: 10 },
  });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'DUPLICATE_SELECTION'));
});

// ---- snapshot ----
test('buildPlayerCardsSnapshot gathers auto + selected set + bound equip + legendary, normalizes equipped', () => {
  const cards = [
    card('a1', 'achievement', 'san_1_achi_1001'),
    troop('core1', 'san_1_troop_5001'),
    eqSet('eset_1', 'A', ['eq_w', 'eq_a', 'eq_c1', 'eq_c2']),
    { ...equip('eq_w', 'eset_1'), is_equipped: 1, equipped_by: 'p1', equipped_slot: 'weapon' },
    equip('eq_a', 'eset_1'), equip('eq_c1', 'eset_1'), equip('eq_c2', 'eset_1'),
    troop('leg1', 'san_1_troop_4001'),
    troop('ignored', 'san_1_troop_1001'), // not selected, not auto
  ];
  const auto = buildAutoInheritedPayload({ cards });
  const snap = buildPlayerCardsSnapshot({
    cards,
    auto,
    selectedEquipmentSetInstanceIds: ['eset_1'],
    selectedLegendaryTroopInstanceIds: ['leg1'],
  });
  const ids = snap.map((r) => r.instance_id).sort();
  assert.deepEqual(ids, ['a1', 'core1', 'eq_a', 'eq_c1', 'eq_c2', 'eq_w', 'eset_1', 'leg1']);
  const w = snap.find((r) => r.instance_id === 'eq_w');
  assert.equal(w.is_equipped, 0);
  assert.equal(w.equipped_by, null);
  assert.equal(w.equipped_slot, null);
  assert.equal(w.bound_equipment_set_instance_id, 'eset_1'); // closure preserved
  assert.ok(!ids.includes('ignored'));
  const coreRow = snap.find((r) => r.instance_id === 'core1');
  assert.equal(coreRow.max_battle_count, 40);
  assert.equal(coreRow.battle_count, 0);
  const legRow = snap.find((r) => r.instance_id === 'leg1');
  assert.equal(legRow.max_battle_count, 20);
  assert.equal(legRow.battle_count, 0);
});

test('normalizeInheritedTroopDurability rewrites max and zeros battle_count', () => {
  const { normalizeInheritedTroopDurability } = require('./seasonSettlementCore.cjs');
  const worn = normalizeInheritedTroopDurability({
    instance_id: 'x',
    card_id: 'san_1_troop_4001',
    card_type: 'troop',
    rarity: 'legendary',
    battle_count: 18,
    max_battle_count: 44,
    lifetime_battle_count: 200,
    veteran_tier: 1,
  });
  assert.equal(worn.max_battle_count, 20);
  assert.equal(worn.battle_count, 0);
  assert.equal(worn.lifetime_battle_count, 200);
  assert.equal(worn.veteran_tier, 1);
  const title = normalizeInheritedTroopDurability({
    instance_id: 't1',
    card_type: 'title',
    battle_count: 9,
  });
  assert.equal(title.battle_count, 9);
});

test('assertSnapshotApplyable passes for a valid snapshot', () => {
  const cards = [
    eqSet('eset_1', 'A', ['eq_w', 'eq_a', 'eq_c1', 'eq_c2']),
    equip('eq_w', 'eset_1'), equip('eq_a', 'eset_1'), equip('eq_c1', 'eset_1'), equip('eq_c2', 'eset_1'),
    troop('leg1', 'san_1_troop_4001'),
  ];
  const snap = buildPlayerCardsSnapshot({
    cards,
    auto: { coreTroopInstanceIds: [], achievementInstanceIds: [], titleInstanceIds: [], treasureInstanceIds: [] },
    selectedEquipmentSetInstanceIds: ['eset_1'],
    selectedLegendaryTroopInstanceIds: ['leg1'],
  });
  assert.doesNotThrow(() => assertSnapshotApplyable(snap));
});

test('assertSnapshotApplyable throws on duplicate / bad type / equipped / unclosed set', () => {
  assert.throws(
    () => assertSnapshotApplyable([card('x', 'troop', 'san_1_troop_1001'), card('x', 'troop', 'san_1_troop_1002')]),
    /SNAPSHOT_DUPLICATE_INSTANCE/
  );
  assert.throws(
    () => assertSnapshotApplyable([card('x', 'weirdType', 'id')]),
    /SNAPSHOT_BAD_CARD_TYPE/
  );
  assert.throws(
    () => assertSnapshotApplyable([{ ...troop('x', 'san_1_troop_1001'), is_equipped: 1 }]),
    /SNAPSHOT_ROW_EQUIPPED/
  );
  assert.throws(
    () => assertSnapshotApplyable([eqSet('eset_1', 'A', ['missing_w', 'missing_a', 'm1', 'm2'])]),
    /SNAPSHOT_EQUIPMENT_NOT_CLOSED/
  );
});
